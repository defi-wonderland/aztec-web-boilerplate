// ============================================================================
// MIME TYPE DETECTION
// ============================================================================

const mimeFromExtension: Record<string, string> = {
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.md': 'text/markdown',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'application/toml',
  '.svg': 'image/svg+xml',
};

export const getMimeType = (fileName: string): string => {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return mimeFromExtension[ext] || 'text/plain';
};

// ============================================================================
// FILE DOWNLOAD
// ============================================================================

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

// ============================================================================
// CLIPBOARD
// ============================================================================

interface CopyToClipboardOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const copyToClipboard = async (
  text: string | undefined,
  options?: CopyToClipboardOptions
): Promise<boolean> => {
  if (!text) return false;

  try {
    // Ensure we have the proper format with 0x prefix for addresses
    const textToCopy =
      text.startsWith('0x') || !isHexString(text) ? text : `0x${text}`;

    await navigator.clipboard.writeText(textToCopy);
    console.log('Copied to clipboard:', textToCopy);
    options?.onSuccess?.();
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    const error =
      err instanceof Error ? err : new Error('Failed to copy to clipboard');
    options?.onError?.(error);
    return false;
  }
};

// Helper to check if a string looks like a hex address
const isHexString = (str: string): boolean => {
  return /^[0-9a-fA-F]+$/.test(str);
};
