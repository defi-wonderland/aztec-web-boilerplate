import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  nodePolyfills,
  type PolyfillOptions,
} from "vite-plugin-node-polyfills";

const nodePolyfillsFix = (options?: PolyfillOptions): Plugin[] => {
  const plugins = nodePolyfills(options);
  const resolveShim: Plugin = {
    name: "node-polyfills-shim-resolver",
    resolveId(source: string) {
      const m =
        /^vite-plugin-node-polyfills\/shims\/(buffer|global|process)$/.exec(
          source
        );
      if (m) {
        return `./node_modules/vite-plugin-node-polyfills/shims/${m[1]}/dist/index.cjs`;
      }
      return undefined;
    },
  };
  return [resolveShim, ...plugins];
};

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Required so the bb.js multithreaded WASM can use SharedArrayBuffer.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    // Aztec logging (pino) must be pre-bundled to avoid runtime resolution issues.
    include: ["pino", "pino/browser"],
    // WASM-bearing Aztec packages must NOT be pre-bundled by esbuild.
    exclude: ["@aztec/noir-acvm_js", "@aztec/noir-noirc_abi", "@aztec/bb.js"],
  },
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfillsFix({ include: ["buffer", "path", "process", "net", "tty"] }),
  ],
});
