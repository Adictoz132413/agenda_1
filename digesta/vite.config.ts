import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * BASE_PATH permite publicar la app en una subcarpeta (p. ej. GitHub Pages:
 * BASE_PATH=/agenda_1/). Por defecto se sirve desde la raíz.
 */
const base = process.env.BASE_PATH ?? '/';

/**
 * Política de seguridad de contenido (sólo en producción): la app no puede
 * conectarse a ningún servidor externo ni cargar scripts de terceros.
 */
const CSP =
  "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; " +
  "connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

function cspPlugin(): Plugin {
  return {
    name: 'digesta-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  base,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    cspPlugin(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'theme-init.js'],
      manifest: {
        id: base,
        name: 'DIGESTA — Mi Diario Digestivo',
        short_name: 'DIGESTA',
        description: 'Diario digestivo personal: comidas, deposiciones, síntomas y patrones de tolerancia. Privado y sin conexión.',
        lang: 'es-CO',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4ef',
        theme_color: '#2f5d50',
        categories: ['health', 'lifestyle', 'medical'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Agregar comida', short_name: 'Comida', url: `${base}#/hoy?nuevo=comida` },
          { name: 'Registrar deposición', short_name: 'Deposición', url: `${base}#/hoy?nuevo=deposicion` },
          { name: 'Registrar síntoma', short_name: 'Síntoma', url: `${base}#/hoy?nuevo=sintoma` },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173 },
});
