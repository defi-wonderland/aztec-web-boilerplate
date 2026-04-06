import { resolve } from 'path';
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

/**
 * Plugin to fix static class field initialization issue with Rollup bundling.
 * When Rollup bundles classes, it transforms `class Foo {}` to `let Foo; Foo = class {}`
 * This breaks static initializers like `static ZERO = new AztecAddress(...)` because
 * they execute before the assignment completes — causing "We is not a constructor".
 *
 * This plugin runs AFTER minification (writeBundle hook) and transforms the minified
 * pattern to a lazy getter that defers initialization.
 * (Copied from root vite.config.ts)
 */
const fixStaticFieldInit = (): Plugin => ({
  name: 'fix-static-field-init',
  enforce: 'post',
  async writeBundle(options, bundle) {
    const fs = await import('fs');
    const path = await import('path');
    const outDir = options.dir || 'dist/host';

    // All static field patterns that break when Rollup hoists class declarations.
    // Each pattern becomes a lazy getter to defer initialization until the class exists.
    const patches: Array<{ pattern: RegExp; replacement: string; tag: string }> = [
      {
        // static ZERO=new X(Y.alloc(32,0))
        pattern: /static ZERO=new (\w+)\((\w+)\.alloc\(32,0\)\)/g,
        replacement: 'static get ZERO(){return this._ZC||(this._ZC=new $1($2.alloc(32,0)))}',
        tag: 'ZERO(alloc)',
      },
      {
        // static ZERO=new X(0n)
        pattern: /static ZERO=new (\w+)\(0n\)/g,
        replacement: 'static get ZERO(){return this._Z0||(this._Z0=new $1(0n))}',
        tag: 'ZERO(0n)',
      },
      {
        // static ONE=new X(1n)
        pattern: /static ONE=new (\w+)\(1n\)/g,
        replacement: 'static get ONE(){return this._O1||(this._O1=new $1(1n))}',
        tag: 'ONE(1n)',
      },
      {
        // static MAX_FIELD_VALUE=new X(this.MODULUS-1n)
        pattern: /static MAX_FIELD_VALUE=new (\w+)\(this\.MODULUS-1n\)/g,
        replacement: 'static get MAX_FIELD_VALUE(){return this._MFV||(this._MFV=new $1(this.MODULUS-1n))}',
        tag: 'MAX_FIELD_VALUE',
      },
    ];

    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (chunk.type === 'chunk' && fileName.endsWith('.js')) {
        const filePath = path.default.join(outDir, fileName);
        let code = fs.default.readFileSync(filePath, 'utf-8');
        let patched = false;

        for (const { pattern, replacement, tag } of patches) {
          // Reset lastIndex since we reuse the regex
          pattern.lastIndex = 0;
          if (pattern.test(code)) {
            pattern.lastIndex = 0;
            code = code.replace(pattern, replacement);
            console.log(`[fix-static-field-init] Patched ${tag} in ${fileName}`);
            patched = true;
          }
        }

        if (patched) {
          fs.default.writeFileSync(filePath, code);
        }
      }
    }
  },
});

/**
 * Plugin to replace @aztec/foundation/crypto/poseidon with our async Worker-based
 * implementation. Uses resolveId to intercept both bare specifier and resolved paths.
 * More robust than resolve.alias for package subpath exports.
 */
const asyncPoseidonReplace = (): Plugin => {
  const replacement = resolve(__dirname, 'src/host/async-poseidon.ts');
  return {
    name: 'async-poseidon-replace',
    enforce: 'pre',
    resolveId(source, importer) {
      // Intercept the bare specifier used in @aztec/* internal imports
      if (source === '@aztec/foundation/crypto/poseidon') {
        console.log(`[async-poseidon-replace] Redirecting: ${source} (from ${importer})`);
        return replacement;
      }
      // Intercept the resolved file path (in case something resolves it before us)
      if (source.includes('@aztec/foundation/dest/crypto/poseidon')) {
        console.log(`[async-poseidon-replace] Redirecting resolved path: ${source} (from ${importer})`);
        return replacement;
      }
      return null;
    },
  };
};

// Cross-origin isolation headers shared between server and preview.
// CORP: cross-origin allows the parent (different origin) to embed us.
// COEP: credentialless for sub-resource loading within the iframe.
// Document-Isolation-Policy (Chrome 137+): gives this iframe its own
// crossOriginIsolated context for SharedArrayBuffer WITHOUT requiring
// the parent to be cross-origin isolated.
const crossOriginHeaders = {
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Document-Isolation-Policy': 'isolate-and-credentialless',
};

export default defineConfig({
  plugins: [
    nodeBuiltinsShim(), // Must be first to intercept before nodePolyfills
    asyncPoseidonReplace(), // Intercept poseidon before other resolution
    react(),
    wasm(),
    topLevelAwait(),
    fixStaticFieldInit(), // Fix static field initialization after bundling
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
  worker: {
    format: 'es',
  },
  esbuild: {
    target: 'esnext',
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
    minify: false,
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      // Forces @aztec packages to be treated as ESM to prevent class identity errors
      defaultIsModuleExports: (id) => {
        if (id.includes('@aztec/')) return false;
        return 'auto';
      },
      exclude: ['@aztec/stdlib/**', '@aztec/foundation/**', '@aztec/aztec.js/**'],
    },
    rollupOptions: {
      input: {
        host: './host.html',
        popup: './popup.html',
      },
      output: {
        format: 'es',
        preserveModules: false,
        inlineDynamicImports: false,
        interop: 'auto',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((name: string) => name.endsWith('.wasm'))) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    port: 3001,
    headers: crossOriginHeaders,
    warmup: {
      clientFiles: ['./src/host/entry.tsx'],
    },
  },
  preview: {
    port: 3001,
    headers: crossOriginHeaders,
  },
  optimizeDeps: {
    force: false,
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'buffer',
      'crypto-browserify',
      'stream-browserify',
      'util',
      'path-browserify',
      '@tanstack/react-query',
    ],
    exclude: ['@aztec/noir-acvm_js', '@aztec/noir-noirc_abi', '@aztec/bb.js'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
