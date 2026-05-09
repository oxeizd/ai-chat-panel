/**
 * Интерфейс файла, полученного из ответа.
 */
export interface FileAttachment {
  filename: string;
  data: string;
  mimeType?: string;
  isUrl?: boolean;
}

/**
 * Извлекает файл из объекта ответа, поддерживая различные форматы.
 * @param responseData - объект ответа
 * @returns FileAttachment или null
 */
export const parseFileFromResponse = (responseData: any): FileAttachment | null => {
  // OpenAI style
  if (responseData.file_url) {
    return {
      filename: responseData.file_name || 'file',
      data: responseData.file_url,
      isUrl: true,
    };
  }

  // Anthropic style
  if (responseData.attachment) {
    return {
      filename: responseData.attachment.filename || 'attachment',
      data: responseData.attachment.data, // base64
      mimeType: responseData.attachment.mime_type,
    };
  }

  // Generic file object
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

/**
 * Скачивание файла: либо открытие URL, либо создание blob.
 * @param file - объект файла
 */
export const downloadFile = (file: FileAttachment) => {
  if (file.isUrl) {
    window.open(file.data, '_blank');
    return;
  }

  // Если data URL
  if (file.data.startsWith('data:')) {
    fetch(file.data)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        triggerDownload(url, file.filename);
      });
    return;
  }

  // Попытка декодирования base64
  let blob: Blob;
  try {
    const binary = atob(file.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: file.mimeType || 'application/octet-stream' });
  } catch {
    blob = new Blob([file.data], { type: file.mimeType || 'text/plain' });
  }

  const url = URL.createObjectURL(blob);
  triggerDownload(url, file.filename);
};

/** Вспомогательная функция для инициирования скачивания */
const triggerDownload = (url: string, filename: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
