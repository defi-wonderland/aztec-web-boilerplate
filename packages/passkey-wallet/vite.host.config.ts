import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  css: {
    postcss: {
      plugins: [
        // Use workspace-root @tailwindcss/postcss so the popup gets Tailwind v4
        (await import('@tailwindcss/postcss')).default,
      ],
    },
  },
  build: {
    outDir: 'dist/host',
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
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
});
