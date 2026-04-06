/**
 * esbuild-based build for the passkey wallet host iframe and popup.
 *
 * We use esbuild instead of Vite/Rollup because Rollup hoists class
 * declarations which breaks Aztec's circular static field initializers
 * (e.g. `static ZERO = new AztecAddress(...)`). esbuild preserves
 * class order correctly.
 */
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

mkdirSync(resolve(root, 'dist/host'), { recursive: true });

// Build host entry (heavy — includes Aztec PXE, bb.js, crypto)
console.log('[build-host] Building host entry...');
await esbuild.build({
  entryPoints: [resolve(root, 'src/host/entry.tsx')],
  bundle: true,
  outfile: resolve(root, 'dist/host/host-entry.js'),
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  jsx: 'automatic',
  inject: [resolve(root, 'scripts/browser-shims.js')],
  alias: {
    'fs': resolve(root, 'scripts/shims/fs.js'),
    'fs/promises': resolve(root, 'scripts/shims/fs.js'),
    'net': resolve(root, 'scripts/shims/net.js'),
    'tty': resolve(root, 'scripts/shims/tty.js'),
    'pino': 'pino/browser.js',
    '@aztec/foundation/crypto/poseidon': resolve(root, 'src/host/async-poseidon.ts'),
  },
  loader: { '.wasm': 'file' },
  minify: true,
  // Keep class names to avoid breaking Aztec's class-based checks
  keepNames: true,
});
console.log('[build-host] Host entry built.');

// Build popup entry (lightweight — React + styles, no Aztec deps)
console.log('[build-host] Building popup entry...');
await esbuild.build({
  entryPoints: [resolve(root, 'src/popup/entry.tsx')],
  bundle: true,
  outfile: resolve(root, 'dist/host/popup-entry.js'),
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  jsx: 'automatic',
  inject: [resolve(root, 'scripts/browser-shims.js')],
  alias: {
    'fs': resolve(root, 'scripts/shims/fs.js'),
    'net': resolve(root, 'scripts/shims/net.js'),
    'tty': resolve(root, 'scripts/shims/tty.js'),
    'pino': 'pino/browser.js',
  },
  loader: { '.wasm': 'file' },
  minify: true,
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
