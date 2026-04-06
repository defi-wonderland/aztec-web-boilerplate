/**
 * esbuild-based build for the passkey wallet host iframe, popup, and PXE Worker.
 *
 * We use esbuild instead of Vite/Rollup because Rollup hoists class
 * declarations which breaks Aztec's circular static field initializers
 * (e.g. `static ZERO = new AztecAddress(...)`). esbuild preserves
 * class order correctly.
 *
 * Three entry points:
 * 1. host-entry.js  — Iframe main thread (SecureChannel, popup coordination, Worker relay)
 * 2. popup-entry.js — Popup window (React + passkey UI)
 * 3. pxe-worker.js  — Web Worker (PXE, BarretenbergSync, account registration)
 *
 * The PXE Worker runs in a context with crossOriginIsolated=true and
 * SharedArrayBuffer, so it doesn't need the BarretenbergSync shim or
 * async-poseidon workarounds that the main thread previously required.
 */
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

mkdirSync(resolve(root, 'dist/host'), { recursive: true });

const commonOptions = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  inject: [resolve(root, 'scripts/browser-shims.js')],
  alias: {
    'fs': resolve(root, 'scripts/shims/fs.js'),
    'fs/promises': resolve(root, 'scripts/shims/fs.js'),
    'net': resolve(root, 'scripts/shims/net.js'),
    'tty': resolve(root, 'scripts/shims/tty.js'),
    'pino': 'pino/browser.js',
  },
  loader: { '.wasm': 'file' },
  minify: true,
  keepNames: true,
};

// Build PXE Worker (heavy — Aztec PXE, BarretenbergSync, crypto)
// This runs in a Worker with crossOriginIsolated=true, so BarretenbergSync
// works natively — no shims needed.
console.log('[build-host] Building PXE Worker...');
await esbuild.build({
  ...commonOptions,
  entryPoints: [resolve(root, 'src/host/pxe-worker.ts')],
  outfile: resolve(root, 'dist/host/pxe-worker.js'),
});
console.log('[build-host] PXE Worker built.');

// Build host entry (lighter now — no Aztec PXE, just SecureChannel + Worker management)
console.log('[build-host] Building host entry...');
await esbuild.build({
  ...commonOptions,
  entryPoints: [resolve(root, 'src/host/entry.tsx')],
  outfile: resolve(root, 'dist/host/host-entry.js'),
  jsx: 'automatic',
});
console.log('[build-host] Host entry built.');

// Build popup entry (lightweight — React + styles, no Aztec deps)
console.log('[build-host] Building popup entry...');
await esbuild.build({
  ...commonOptions,
  entryPoints: [resolve(root, 'src/popup/entry.tsx')],
  outfile: resolve(root, 'dist/host/popup-entry.js'),
  jsx: 'automatic',
});
console.log('[build-host] Popup entry built.');

// Generate HTML files
const hostHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body>
  <div id="root"></div>
  <script type="module" src="./host-entry.js"></script>
</body>
</html>`;

const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aztec Wallet</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./popup-entry.js"></script>
</body>
</html>`;

writeFileSync(resolve(root, 'dist/host/host.html'), hostHtml);
writeFileSync(resolve(root, 'dist/host/popup.html'), popupHtml);

console.log('[build-host] HTML files written.');
console.log('[build-host] Build complete! Output in dist/host/');
