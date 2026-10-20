'use strict';
/* Prueba integral de CALZADOS ISA ARENAS contra los emuladores locales.
   Cubre: sitio público (catálogo desde Firestore), login ISA, CRUD de
   producto y categoría, publicación y persistencia tras cerrar sesión. */
const { chromium } = require('C:/Users/usuario29/Documents/KONFIO_ZINC/6-LANDING-PAGES/Konfio-Zinc-Web/herramientas/node_modules/playwright');

const BASE = 'http://127.0.0.1:5170/';
let fallos = 0, pasos = 0;
function ok(cond, nombre, detalle = '') {
  pasos++;
  const marca = cond ? 'PASA' : '**FALLA**';
  if (!cond) fallos++;
  console.log(`  [${marca}] ${nombre}` + (detalle ? ' — ' + detalle : ''));
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const nav = await chromium.launch({ headless: true });
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO' });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(e.message));

  console.log('\n═══ 1 · Sitio público (catálogo desde Firestore) ═══');
  await pag.goto(BASE + 'index.html', { waitUntil: 'load' });
  await pag.waitForTimeout(1200);
  const publico = await pag.evaluate(() => ({
    titulo: document.title,
    marca: document.querySelector('#marcaNombre') && document.querySelector('#marcaNombre').textContent,
    productos: document.querySelectorAll('.ficha').length,
    videos: document.querySelectorAll('.video-card video').length,
    aviso: !!(document.querySelector('#aviso') && !document.querySelector('#aviso').classList.contains('hidden')),
    whatsapp: document.querySelector('.js-wa') ? document.querySelector('.js-wa').getAttribute('href') : ''
  }));
  ok(publico.titulo.includes('ISA'), 'título del sitio es ISA', publico.titulo);
  ok(publico.productos >= 4, 'productos visibles (≥4)', String(publico.productos));
  ok(publico.videos === 3, '3 vídeos con controles', String(publico.videos));
  ok(!publico.aviso, 'sin aviso de respaldo (leyó Firestore)', publico.aviso ? 'usa respaldo local' : '');
  ok(/wa\.me\/573103255067/.test(publico.whatsapp || ''), 'WhatsApp ISA 310 325 5067', publico.whatsapp);

  console.log('\n═══ 2 · Login del panel como ISA ═══');
  await pag.goto(BASE + 'admin.html', { waitUntil: 'load' });
  await pag.waitForTimeout(800);
  await pag.fill('#email', 'isa@demo.local');
  await pag.fill('#password', 'DemoIsa2026');
  await pag.click('#btnLogin');
  await pag.waitForTimeout(1500);
  const rol = await pag.evaluate(() => document.querySelector('.rol') ? document.querySelector('.rol').textContent : '');
  ok(/ISA ARENAS/.test(rol), 'rol ISA reconocido', rol);

  console.log('\n═══ 3 · Crear categoría y producto ═══');
  await pag.click('[data-tab="categorias"]');
  await pag.waitForTimeout(400);
  await pag.click('#btnNuevaCategoria');
  await pag.waitForTimeout(300);
  await pag.fill('#c-nombre', 'Niños');
  await pag.click('#btnGuardarCategoria');
  await pag.waitForTimeout(900);
  ok(await pag.evaluate(() => document.body.textContent.includes('Niños')), 'categoría "Niños" creada');

  await pag.click('[data-tab="productos"]');
  await pag.waitForTimeout(400);
  await pag.click('#btnNuevoProducto');
  await pag.waitForTimeout(300);
  await pag.fill('#f-nombre', 'Chanclas niña rosa');
  await pag.selectOption('#f-categoria', await pag.evaluate(() => { const o = [...document.querySelectorAll('#f-categoria option')].find((x) => x.textContent === 'Niños'); return o ? o.value : null; }));
  await pag.fill('#f-precio', '25000');
  await pag.fill('#f-tallas', 'Niña 25 a 31');
  await pag.fill('#f-desc', 'Prueba de producto nuevo.');
  await pag.click('#btnGuardarProducto');
  await pag.waitForTimeout(900);
  ok(await pag.evaluate(() => document.body.textContent.includes('Chanclas niña rosa')), 'producto "Chanclas niña rosa" creado');

  console.log('\n═══ 4 · Publicar y ver en el sitio público ═══');
  await pag.click('#btnPublish');
  await pag.waitForTimeout(1200);
  await pag.goto(BASE + 'index.html', { waitUntil: 'load' });
  await pag.waitForTimeout(1200);
  const trasPublicar = await pag.evaluate(() => ({
    tieneNinos: document.body.textContent.includes('Niños'),
    tieneProducto: document.body.textContent.includes('Chanclas niña rosa'),
    precio: document.body.textContent.includes('25.000')
  }));
  ok(trasPublicar.tieneNinos, 'categoría publicada visible', '');
  ok(trasPublicar.tieneProducto, 'producto publicado visible', '');
  ok(trasPublicar.precio, 'precio publicado visible ($25.000)', '');

  console.log('\n═══ 5 · Persistencia tras cerrar y volver a entrar ═══');
  await pag.goto(BASE + 'admin.html', { waitUntil: 'load' });
  await pag.waitForTimeout(900);
  // cerrar sesión
  const btnSalir = await pag.$('#btnLogout');
  if (btnSalir) { await btnSalir.click(); await pag.waitForTimeout(700); }
  // volver a entrar
  await pag.fill('#email', 'isa@demo.local');
  await pag.fill('#password', 'DemoIsa2026');
  await pag.click('#btnLogin');
  await pag.waitForTimeout(1400);
  ok(await pag.evaluate(() => document.body.textContent.includes('Chanclas niña rosa')), 'producto persiste tras re-login (Firestore)', '');

  console.log('\n═══ 6 · Eliminar producto y categoría (limpieza) ═══');
  pag.on('dialog', (d) => d.accept());
  await pag.evaluate(() => {
    const card = [...document.querySelectorAll('.pcard')].find((c) => c.textContent.includes('Chanclas niña rosa'));
    if (card) card.querySelector('[data-act="eliminar"]').click();
  });
  await pag.waitForTimeout(900);
  await pag.click('[data-tab="categorias"]');
  await pag.waitForTimeout(400);
  await pag.evaluate(() => {
    const card = [...document.querySelectorAll('.pcard')].find((c) => c.textContent.includes('Niños'));
    if (card) card.querySelector('[data-act="eliminar"]').click();
  });
  await pag.waitForTimeout(900);

  console.log('\n═══ Resumen ═══');
  console.log(`  pasos: ${pasos} · fallos: ${fallos} · errores de página: ${errores.length}`);
  if (errores.length) errores.slice(0, 3).forEach((e) => console.log('   · ' + e));
  await nav.close();
  process.exit(fallos || errores.length ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
