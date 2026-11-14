/**
 * Genera los iconos PNG de la PWA a partir del diseño SVG usando el Chromium
 * de Playwright (si está disponible). Uso: npm run icons
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url));

// Icono estándar: esquinas redondeadas. Maskable: fondo completo y logo dentro de la zona segura (80 %).
const leaf = `
  <path d="M20 42c0-13 10-22 26-23-1 15-9 25-22 25-1.6 0-3-.7-4-2z" fill="#f6f4ef"/>
  <path d="M21 43c5-7 10-11 17-15" stroke="#2f5d50" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2f5d50"/>${leaf}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2f5d50"/><g transform="translate(9.6 9.6) scale(0.7)">${leaf}</g></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(out(file), buf);
  console.log('✓', file);
}
await render(standard, 192, 'icon-192.png');
await render(standard, 512, 'icon-512.png');
await render(maskable, 512, 'icon-maskable-512.png');
await render(maskable, 180, 'apple-touch-icon.png');
await browser.close();
