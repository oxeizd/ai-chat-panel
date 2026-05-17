// utils/downloadFile.ts

export interface FileAttachment {
  filename: string;
  data: string;
  mimeType?: string;
  isUrl?: boolean;
}

export async function downloadFile(attachment: FileAttachment): Promise<void> {
  const { filename, data, mimeType, isUrl } = attachment;

  // Случай 1: это ссылка (URL)
  if (isUrl) {
    window.open(data, '_blank');
    return;
  }

  // Случай 2: base64 или data URL
  let blob: Blob;
  const mime = mimeType || 'application/octet-stream';

  if (data.startsWith('data:')) {
    // Если уже data URL
    const response = await fetch(data);
    blob = await response.blob();
  } else {
    // Обычный base64 без префикса
    const byteCharacters = atob(data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    blob = new Blob([byteArray], { type: mime });
  }

  // Создаём ссылку и скачиваем
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
