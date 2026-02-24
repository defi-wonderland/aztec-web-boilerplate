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
