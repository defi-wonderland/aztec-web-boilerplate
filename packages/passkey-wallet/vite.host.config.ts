import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

/**
 * Shim Node.js built-in modules that shouldn't run in browser.
 * Must run before nodePolyfills to intercept fs/promises correctly.
 * (Copied from root vite.config.ts — Aztec packages pull in Node.js deps)
 */
const nodeBuiltinsShim = (): Plugin => ({
  name: 'node-builtins-shim',
  enforce: 'pre',
  resolveId(source) {
    if (
      source === 'fs/promises' ||
      source === 'fs' ||
      source === 'net' ||
      source === 'tty'
    ) {
      return `\0virtual:${source}`;
    }
    return null;
  },
  load(id) {
    if (id === '\0virtual:fs/promises') {
      return `
        export const mkdir = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const writeFile = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const readFile = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const rm = () => Promise.reject(new Error('fs/promises not available in browser'));
        export default { mkdir, writeFile, readFile, rm };
      `;
    }
    if (id === '\0virtual:fs') {
      return `
        export const existsSync = () => false;
        export const readFileSync = () => { throw new Error('fs not available in browser'); };
        export const writeFileSync = () => { throw new Error('fs not available in browser'); };
        export const mkdirSync = () => { throw new Error('fs not available in browser'); };
        export default { existsSync, readFileSync, writeFileSync, mkdirSync };
      `;
    }
    if (id === '\0virtual:net') {
      return `
        export const Socket = class Socket { constructor() { throw new Error('net not available in browser'); } };
        export const connect = () => { throw new Error('net not available in browser'); };
        export default { Socket, connect };
      `;
    }
    if (id === '\0virtual:tty') {
      return `
        export const isatty = () => false;
        export default { isatty };
      `;
    }
    return null;
  },
});

export default defineConfig({
  plugins: [
    nodeBuiltinsShim(),
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: [
        'buffer',
        'crypto',
        'util',
        'assert',
        'process',
        'stream',
        'path',
        'events',
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      exclude: ['fs', 'net', 'tty'],
    }),
  ],
  root: '.',
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util',
      path: 'path-browserify',
      pino: 'pino/browser.js',
      'hash.js': 'hash.js/lib/hash.js',
      sha3: 'sha3/index.js',
      'lodash.chunk': 'lodash.chunk/index.js',
      'lodash.times': 'lodash.times/index.js',
      'lodash.isequal': 'lodash.isequal/index.js',
      'lodash.pickby': 'lodash.pickby/index.js',
      'json-stringify-deterministic': 'json-stringify-deterministic/lib/index.js',
    },
  },
  css: {
    postcss: {
      plugins: [
        (await import('@tailwindcss/postcss')).default,
      ],
    },
  },
  build: {
    outDir: 'dist/host',
    sourcemap: false,
    target: 'esnext',
    rollupOptions: {
      input: {
        host: './host.html',
        popup: './popup.html',
      },
    },
  },
  server: {
    port: 3001,
    headers: {
      // No COOP — this page is embedded in an iframe, COOP: same-origin
      // would prevent the parent from communicating with us.
      // CORP: cross-origin allows the parent (different port) to embed us.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'buffer',
      'crypto-browserify',
      'stream-browserify',
      'util',
      'path-browserify',
    ],
    exclude: ['@aztec/noir-acvm_js', '@aztec/noir-noirc_abi', '@aztec/bb.js'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
