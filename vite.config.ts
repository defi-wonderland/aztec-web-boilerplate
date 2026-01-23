import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

/**
 * Plugin to shim Node.js built-in modules that shouldn't run in browser.
 * Must run before nodePolyfills to intercept fs/promises correctly.
 */
const nodeBuiltinsShim = (): Plugin => ({
  name: 'node-builtins-shim',
  enforce: 'pre', // Run before other plugins
  resolveId(source) {
    // Intercept Node.js modules that need shimming
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
    // Provide shims for Node.js-only modules
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

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const artifactRegistryUrl = env.VITE_ARTIFACT_REGISTRY_URL;

  return {
    plugins: [
    nodeBuiltinsShim(), // Must be first to intercept before nodePolyfills
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      // Include specific polyfills that your Webpack config provided
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
      // Exclude modules we're shimming ourselves
      exclude: ['fs', 'net', 'tty'],
    }),
  ],
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis',
    // In dev: use proxy path. In prod: use real URL from env
    'import.meta.env.VITE_ARTIFACT_REGISTRY_URL': JSON.stringify(
      command === 'serve' ? '/artifact-registry' : artifactRegistryUrl
    ),
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      // Additional polyfills for blockchain dependencies
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util',
      path: 'path-browserify',
      // Use browser-safe pino version
      pino: 'pino/browser.js',
      // Force specific hash.js path for proper CommonJS handling
      'hash.js': 'hash.js/lib/hash.js',
      // Fix sha3 CommonJS exports
      sha3: 'sha3/index.js',
      // Fix lodash.chunk CommonJS exports
      'lodash.chunk': 'lodash.chunk/index.js',
      // Fix lodash.times CommonJS exports
      'lodash.times': 'lodash.times/index.js',
      // Fix lodash.isequal CommonJS exports
      'lodash.isequal': 'lodash.isequal/index.js',
      // Fix lodash.pickby CommonJS exports
      'lodash.pickby': 'lodash.pickby/index.js',
      // Fix json-stringify-deterministic CommonJS exports
      'json-stringify-deterministic':
        'json-stringify-deterministic/lib/index.js',
    },
    // Dedupe critical packages to prevent class identity issues
    dedupe: ['@aztec/foundation', '@aztec/circuits.js', '@noble/curves'],
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    fs: {
      allow: ['..'],
    },
    proxy: artifactRegistryUrl
      ? {
          '/artifact-registry': {
            target: artifactRegistryUrl,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/artifact-registry/, ''),
          },
        }
      : undefined,
  },
  preview: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
  build: {
    sourcemap: false, // Disable sourcemaps to reduce memory usage
    minify: 'esbuild',
    chunkSizeWarningLimit: 2000, // Increase chunk size warning limit
    commonjsOptions: {
      // Forces @aztec packages to be treated as ESM to prevent class identity errors
      defaultIsModuleExports: (id) => {
        if (id.includes('@aztec/')) {
          return false;
        }
        return 'auto';
      },
    },
    rollupOptions: {
      output: {
        format: 'es',
        preserveModules: false,
        inlineDynamicImports: false,
        interop: 'auto',
        assetFileNames: (assetInfo) => {
          if ((assetInfo as any).name?.endsWith('.wasm')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
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
      '@tanstack/react-query',
    ],
    exclude: [
      '@aztec/bb.js',
      '@aztec/pxe',
      '@aztec/pxe/client/lazy',
      '@aztec/foundation',
      '@aztec/circuits.js',
      '@aztec/noir-contracts.js',
      '@aztec/ethereum',
      '@aztec/accounts',
      '@defi-wonderland/aztec-standards',
      'noirc_abi_wasm',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
};
});
