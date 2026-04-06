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

/**
 * esbuild plugin: replace BarretenbergSync with our async Worker-based shim.
 *
 * All @aztec/* packages import BarretenbergSync from @aztec/bb.js.
 * In a credentialless iframe, BarretenbergSync can't initialize (needs
 * SharedArrayBuffer). Our shim wraps the async Barretenberg backend
 * (runs in a Worker) with the BarretenbergSync API surface.
 *
 * We intercept the specific file that exports BarretenbergSync and
 * redirect to our shim. This way all consumers get the shim transparently.
 */
/**
 * esbuild plugin: patch BarretenbergSync to use async Worker backend.
 *
 * Instead of replacing the whole @aztec/bb.js module (which exports many
 * things), we intercept the specific file that defines BarretenbergSync
 * and make its initSingleton() use the async Barretenberg backend.
 *
 * The key insight: all code does `await BarretenbergSync.initSingleton()`
 * before using the singleton. We make initSingleton() initialize the
 * async Worker-based backend instead of the sync WASM one.
 */
const bbSyncShimPlugin = {
  name: 'bb-sync-shim',
  setup(build) {
    // Intercept the BarretenbergSync class definition file
    const syncClassPath = 'barretenberg_wasm/barretenberg_wasm_main/index';
    build.onLoad({ filter: /bb\.js\/dest\/browser\/barretenberg\/index\.js$/ }, async (args) => {
      const fs = await import('fs');
      let contents = fs.readFileSync(args.path, 'utf8');

      // Patch: after the original exports, add our override
      contents += `
;// BB-SYNC-SHIM: Override BarretenbergSync to use async Worker backend
const _origInitSingleton = BarretenbergSync.initSingleton;
let _asyncInstance = null;
let _asyncInitPromise = null;

BarretenbergSync.initSingleton = async function() {
  if (_asyncInstance) return;
  if (_asyncInitPromise) { await _asyncInitPromise; return; }

  _asyncInitPromise = (async () => {
    console.log('[bb-sync-shim] Using async Barretenberg (Worker backend)');
    const bb = await Barretenberg.new();
    _asyncInstance = { _bb: bb };

    // Monkey-patch getSingleton to return a proxy that delegates to async bb
    const origGetSingleton = BarretenbergSync.getSingleton;
    BarretenbergSync.getSingleton = function() {
      return new Proxy({}, {
        get(target, prop) {
          if (prop === '_bb') return bb;
          const method = bb[prop];
          if (typeof method === 'function') return method.bind(bb);
          return method;
        }
      });
    };
  })();

  await _asyncInitPromise;
};
`;
      return { contents, loader: 'js' };
    });
  },
};

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
  plugins: [bbSyncShimPlugin],
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
