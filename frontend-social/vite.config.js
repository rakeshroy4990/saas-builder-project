import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

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

export default defineConfig({
  plugins: [tailwindcss(), vue(), forceReloadOnUiChanges()],
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
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))]
  }
});
