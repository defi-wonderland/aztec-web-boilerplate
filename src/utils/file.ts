import { getMimeType } from './mime';

/**
 * Downloads a string as a file via a temporary anchor element.
 */
export const downloadAsFile = (
  content: string,
  filename: string,
  mimeType?: string
): void => {
  const blob = new Blob([content], {
    type: mimeType ?? getMimeType(filename),
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
