'use strict';
/* Capturas de CALZADOS ISA ARENAS: catálogo móvil/escritorio y panel. */
const { chromium } = require('C:/Users/usuario29/Documents/KONFIO_ZINC/6-LANDING-PAGES/Konfio-Zinc-Web/herramientas/node_modules/playwright');
const BASE = 'http://127.0.0.1:5170/';
const OUT = 'C:/KZ-EVIDENCIA/isa-arenas';

(async () => {
  const nav = await chromium.launch({ headless: true });
  const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });

  // catálogo público
  for (const ancho of [375, 1440]) {
    const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho <= 768 ? 812 : 900 }, reducedMotion: 'reduce', locale: 'es-CO' });
    const pag = await ctx.newPage();
    await pag.goto(BASE + 'index.html?emulador=1', { waitUntil: 'load' });
    await pag.waitForTimeout(1500);
    await pag.screenshot({ path: `${OUT}/catalogo-${ancho}.png` });
    await pag.screenshot({ path: `${OUT}/catalogo-${ancho}-completa.png`, fullPage: true });
    await ctx.close();
  }

  // panel: login + dashboard
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'es-CO' });
  const pag = await ctx.newPage();
  await pag.goto(BASE + 'admin.html?emulador=1', { waitUntil: 'load' });
  await pag.waitForTimeout(700);
  await pag.screenshot({ path: `${OUT}/panel-login.png` });
  await pag.fill('#email', 'isa@demo.local'); await pag.fill('#password', 'DemoIsa2026'); await pag.click('#btnLogin');
  await pag.waitForTimeout(1500);
  await pag.screenshot({ path: `${OUT}/panel-productos.png` });
  await pag.click('#btnNuevoProducto'); await pag.waitForTimeout(400);
  await pag.screenshot({ path: `${OUT}/panel-editor-producto.png` });
  await pag.click('[data-close]'); await pag.waitForTimeout(200);
  await pag.click('[data-tab="categorias"]'); await pag.waitForTimeout(300);
  await pag.screenshot({ path: `${OUT}/panel-categorias.png` });
  await pag.click('[data-tab="contenido"]'); await pag.waitForTimeout(300);
  await pag.screenshot({ path: `${OUT}/panel-contenido.png` });

  await nav.close();
  console.log('capturas en', OUT);
})();
