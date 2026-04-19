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

/** Same JPEG URL string as in `index.html` (og:image / twitter:image / og:image:secure_url). */
const CLOUDINARY_OG_IMAGE =
  'https://res.cloudinary.com/dbke33vfd/image/upload/c_fill,g_center,w_1200,h_630/v1776158879/Dr_Swati_Pandey_rtmfqj.jpg';

/**
 * WhatsApp / Facebook crawlers prefer an absolute HTTPS `og:image` on the same host as the link when possible,
 * plus `og:url` + canonical. Set `VITE_PUBLIC_SITE_URL` on Render (no trailing slash), e.g. `https://oshu-ai-clinic-ui.onrender.com`.
 */
function injectLinkPreviewMeta() {
  const origin = (process.env.VITE_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  const ogImageAbs = origin ? `${origin}/og-share.jpg` : CLOUDINARY_OG_IMAGE;

  return {
    name: 'inject-link-preview-meta',
    transformIndexHtml(html) {
      let out = html.split(CLOUDINARY_OG_IMAGE).join(ogImageAbs);
      if (origin) {
        const block = `    <link rel="canonical" href="${origin}/" />\n    <meta property="og:url" content="${origin}/" />\n`;
        out = out.replace('<meta property="og:type"', `${block}    <meta property="og:type"`);
      }
      return out;
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), vue(), injectLinkPreviewMeta(), forceReloadOnUiChanges(), copyIndexTo404()],
  build: {
    /** `agora-rtc-sdk-ng` is ~1.5MB minified; lazy-loaded with video-call UI but still one vendor chunk. */
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('agora-rtc-sdk-ng') || id.includes('@agora-js')) return 'agora-rtc';
          if (id.includes('/vue/') || id.includes('vue-router') || id.includes('/pinia/')) return 'vue-vendor';
          if (id.includes('axios')) return 'axios';
          if (id.includes('@stomp')) return 'stomp';
          if (id.includes('vue-async-ui')) return 'async-ui';
        }
      }
    }
  },
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
