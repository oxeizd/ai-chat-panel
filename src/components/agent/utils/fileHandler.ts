export interface FileAttachment {
  filename: string;
  data: string;
  mimeType?: string;
  isUrl?: boolean;
}

export const parseFileFromResponse = (responseData: any): FileAttachment | null => {
  // OpenAI style: file_id + file_url
  if (responseData.file_url) {
    return {
      filename: responseData.file_name || 'file',
      data: responseData.file_url,
      isUrl: true,
    };
  }

  // Anthropic style: attachment
  if (responseData.attachment) {
    return {
      filename: responseData.attachment.filename || 'attachment',
      data: responseData.attachment.data, // base64
      mimeType: responseData.attachment.mime_type,
    };
  }

  // Generic: file object
  if (responseData.file) {
    return {
      filename: responseData.file.filename || responseData.file.name || 'file',
      data: responseData.file.url || responseData.file.content || responseData.file.data,
      mimeType: responseData.file.mime_type || responseData.file.type,
      isUrl: !!responseData.file.url,
    };
  }

  // Content-Disposition из SSE
  if (responseData.content_type === 'file' || responseData.type === 'file') {
    return {
      filename: responseData.filename || 'download',
      data: responseData.data || responseData.content,
      mimeType: responseData.mime_type || responseData.mimeType,
    };
  }

  return null;
};

export const downloadFile = (file: FileAttachment) => {
  if (file.isUrl) {
    window.open(file.data, '_blank');
    return;
  }

  // Декодируем base64 если нужно
  let blob: Blob;
  if (file.data.startsWith('data:')) {
    // Это data URL
    const response = fetch(file.data);
    response
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        triggerDownload(url, file.filename);
      });
    return;
  }

  // Чистый base64
  try {
    const binary = atob(file.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: file.mimeType || 'application/octet-stream' });
  } catch {
    // Обычный текст
    blob = new Blob([file.data], { type: file.mimeType || 'text/plain' });
  }

  const url = URL.createObjectURL(blob);
  triggerDownload(url, file.filename);
};

const triggerDownload = (url: string, filename: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
