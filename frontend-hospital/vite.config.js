import { copyFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';

function forceReloadOnUiChanges() {
  const watchedUiFile = /\/src\/(components|configs|core|modules)\/.*\.(vue|ts|js)$/;
  return {
    name: 'force-reload-on-ui-changes',
    handleHotUpdate(ctx) {
      if (watchedUiFile.test(ctx.file)) {
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    }
  };
}

// When the CDN has no file at /page/..., add 404.html (copy of index) as a fallback.
// On Render, also add a rewrite: all paths to /index.html (see docs/render-hospital-manual-deploy.md).
function copyIndexTo404() {
  return {
    name: 'copy-index-to-404',
    closeBundle() {
      const dist = path.join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
      const indexHtml = path.join(dist, 'index.html');
      const notFound = path.join(dist, '404.html');
      if (existsSync(indexHtml)) {
        copyFileSync(indexHtml, notFound);
      }
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), vue(), forceReloadOnUiChanges(), copyIndexTo404()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    hmr: {
      overlay: true
    },
    watch: {
      usePolling: true,
      interval: 120
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@realtime': fileURLToPath(new URL('../frontend-realtime-lib/src', import.meta.url)),
      '@stomp/stompjs': fileURLToPath(
        new URL('./node_modules/@stomp/stompjs/esm6/index.js', import.meta.url)
      )
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))]
  }
});
