/**
 * Simple HTTP server for the wallet host iframe.
 *
 * Serves dist/host/ on port 3001 with the cross-origin headers required
 * for credentialless iframe embedding from a different origin (the dapp).
 */
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'dist', 'host');
const PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const CROSS_ORIGIN_HEADERS = {
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Document-Isolation-Policy': 'isolate-and-credentialless',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const server = createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CROSS_ORIGIN_HEADERS);
    res.end();
    return;
  }

  let url = req.url || '/';
  // Strip query string
  url = url.split('?')[0];
  // Default to host.html
  if (url === '/') url = '/host.html';

  const filePath = resolve(DIST_DIR, '.' + url);

  // Prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Not found: ${url}`);
    return;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      ...CROSS_ORIGIN_HEADERS,
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Server error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`[serve-host] Serving dist/host/ at http://localhost:${PORT}`);
  console.log(`[serve-host] Host iframe: http://localhost:${PORT}/host.html`);
  console.log(`[serve-host] Popup:       http://localhost:${PORT}/popup.html`);
  console.log('[serve-host] Headers: CORP=cross-origin, COEP=credentialless, DIP=isolate-and-credentialless');
});
