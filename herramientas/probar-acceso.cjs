'use strict';
/* Prueba de acceso y separación de roles del panel ISA ARENAS. */
const { chromium } = require('C:/Users/usuario29/Documents/KONFIO_ZINC/6-LANDING-PAGES/Konfio-Zinc-Web/herramientas/node_modules/playwright');
const BASE = 'http://127.0.0.1:5170/';
let fallos = 0, pasos = 0;
const ok = (c, n, d = '') => { pasos++; if (!c) fallos++; console.log(`  [${c ? 'PASA' : '**FALLA**'}] ${n}${d ? ' — ' + d : ''}`); };

(async () => {
  const nav = await chromium.launch({ headless: true });
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-CO' });
  const pag = await ctx.newPage();

  // 1) contraseña incorrecta → error y sin panel
  await pag.goto(BASE + 'admin.html?emulador=1', { waitUntil: 'load' });
  await pag.waitForTimeout(700);
  await pag.fill('#email', 'isa@demo.local');
  await pag.fill('#password', 'clave-incorrecta');
  await pag.click('#btnLogin');
  await pag.waitForTimeout(1200);
  ok(await pag.evaluate(() => document.body.textContent.includes('incorrectos') || document.body.textContent.includes('Correo o contraseña')), 'acceso no autorizado rechazado');

  // 2) ISA NO ve la pestaña Usuarios
  await pag.fill('#email', 'isa@demo.local');
  await pag.fill('#password', 'DemoIsa2026');
  await pag.click('#btnLogin');
  await pag.waitForTimeout(1400);
  ok(await pag.evaluate(() => document.querySelector('.rol').textContent.includes('ISA')), 'ISA autenticada como admin');
  ok(!await pag.evaluate(() => [...document.querySelectorAll('.tab')].some((t) => t.textContent === 'Usuarios')), 'ISA no ve la pestaña Usuarios (separación de roles)');

  // 3) KONFÍO sí ve Usuarios
  await pag.click('#btnLogout'); await pag.waitForTimeout(600);
  await pag.fill('#email', 'admin@konfiozinc.local');
  await pag.fill('#password', 'DemoKonfio2026');
  await pag.click('#btnLogin');
  await pag.waitForTimeout(1400);
  ok(await pag.evaluate(() => document.querySelector('.rol').textContent.includes('superadmin')), 'KONFÍO autenticada como superadmin');
  await pag.click('[data-tab="usuarios"]'); await pag.waitForTimeout(400);
  ok(await pag.evaluate(() => document.body.textContent.includes('isa@demo.local') && document.body.textContent.includes('admin@konfiozinc.local')), 'KONFÍO ve el listado de usuarios');

  console.log(`\n═══ Resumen acceso ═══\n  pasos: ${pasos} · fallos: ${fallos}`);
  await nav.close();
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
