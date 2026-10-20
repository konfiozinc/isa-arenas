'use strict';
/* Prueba del carrito de CALZADOS ISA ARENAS (con emuladores).
   Verifica: tallas, cantidad, totales, pedido por WhatsApp, producto sin
   precio (a confirmar) y producto inactivo. */
const { chromium } = require('C:/Users/usuario29/Documents/KONFIO_ZINC/6-LANDING-PAGES/Konfio-Zinc-Web/herramientas/node_modules/playwright');
const BASE = 'http://127.0.0.1:5170/';
let fallos = 0, pasos = 0;
const ok = (c, n, d = '') => { pasos++; if (!c) fallos++; console.log(`  [${c ? 'PASA' : '**FALLA**'}] ${n}${d ? ' — ' + d : ''}`); };

(async () => {
  const nav = await chromium.launch({ headless: true });
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO' });
  const pag = await ctx.newPage();

  // 1) preparar: crear producto con tallas y precio + marcar "planas" agotado
  await pag.goto(BASE + 'admin.html?emulador=1', { waitUntil: 'load' });
  await pag.waitForTimeout(700);
  await pag.fill('#email', 'isa@demo.local'); await pag.fill('#password', 'DemoIsa2026'); await pag.click('#btnLogin');
  await pag.waitForTimeout(1400);
  // nuevo producto
  await pag.click('#btnNuevoProducto'); await pag.waitForTimeout(300);
  await pag.fill('#f-nombre', 'Chanclas niña rosa');
  await pag.selectOption('#f-categoria', await pag.evaluate(() => { const o = [...document.querySelectorAll('#f-categoria option')].find((x) => x.textContent === 'Dama'); return o.value; }));
  await pag.fill('#f-precio', '25000');
  await pag.fill('#f-tallas', '25, 26, 27');
  await pag.click('#btnGuardarProducto'); await pag.waitForTimeout(900);
  // marcar "planas" agotado
  await pag.evaluate(() => { const c = [...document.querySelectorAll('.pcard')].find((x) => x.textContent.includes('Chanclas planas')); c.querySelector('[data-act="disponible"]').click(); });
  await pag.waitForTimeout(800);
  await pag.click('#btnPublish'); await pag.waitForTimeout(1200);

  // 2) sitio público
  await pag.goto(BASE + 'index.html?emulador=1', { waitUntil: 'load' });
  await pag.waitForTimeout(1200);
  ok(await pag.evaluate(() => document.body.textContent.includes('Chanclas niña rosa')), 'producto nuevo visible');
  ok(await pag.evaluate(() => document.body.textContent.includes('25.000')), 'precio $25.000 visible');
  const agotadoDeshabilitado = await pag.evaluate(() => { const c = [...document.querySelectorAll('.ficha')].find((x) => x.textContent.includes('Chanclas planas')); return c.querySelector('.btn-detalle').disabled; });
  ok(agotadoDeshabilitado, 'producto agotado no se puede agregar');

  // 3) agregar con talla + cantidad
  await pag.evaluate(() => { const c = [...document.querySelectorAll('.ficha')].find((x) => x.textContent.includes('Chanclas niña rosa')); c.querySelector('.btn-detalle').click(); });
  await pag.waitForTimeout(400);
  await pag.click('.talla[data-talla="26"]');
  await pag.click('#detQtyMas');   // cantidad 2
  await pag.click('#btnAgregar');
  await pag.waitForTimeout(500);
  // cerrar el carrito para agregar el siguiente producto
  await pag.click('#carritoOverlay [data-close]');
  await pag.waitForTimeout(300);
  await pag.evaluate(() => { const c = [...document.querySelectorAll('.ficha')].find((x) => x.textContent.includes('Chanclas altas')); c.querySelector('.btn-detalle').click(); });
  await pag.waitForTimeout(300);
  await pag.click('#btnAgregar');
  await pag.waitForTimeout(500);

  // 4) carrito
  const carrito = await pag.evaluate(() => ({
    items: [...document.querySelectorAll('.cart-item')].map((x) => x.textContent),
    total: document.querySelector('.cart-total strong') ? document.querySelector('.cart-total strong').textContent : ''
  }));
  ok(carrito.items.some((t) => t.includes('Chanclas niña rosa') && t.includes('Talla 26')), 'ítem con talla 26 en carrito');
  ok(carrito.items.some((t) => t.includes('Chanclas altas')), 'ítem sin precio agregado');
  ok(carrito.total === 'a confirmar', 'total "a confirmar" (hay ítem sin precio)', carrito.total);

  // 5) modificar cantidad y eliminar
  const fila = await pag.evaluateHandle(() => [...document.querySelectorAll('.cart-item')].find((x) => x.textContent.includes('Chanclas niña rosa')));
  await fila.asElement().$eval('[data-q="+"]', (b) => b.click());   // 2 -> 3
  await pag.waitForTimeout(300);
  ok(await pag.evaluate(() => [...document.querySelectorAll('.cart-item')].find((x) => x.textContent.includes('Chanclas niña rosa')).textContent.includes('3')), 'cantidad incrementada a 3');

  // 6) mensaje de pedido por WhatsApp
  await pag.evaluate(() => { window.__waUrl = null; window.open = (u) => { window.__waUrl = u; return null; }; });
  await pag.click('#btnEnviarPedido');
  await pag.waitForTimeout(400);
  const waUrl = await pag.evaluate(() => window.__waUrl || '');
  ok(waUrl.startsWith('https://wa.me/573103255067'), 'pedido va al WhatsApp de ISA');
  const msj = decodeURIComponent(waUrl.split('?text=')[1] || '');
  ok(msj.includes('Chanclas niña rosa'), 'mensaje incluye referencia');
  ok(msj.includes('Talla 26'), 'mensaje incluye talla');
  ok(msj.includes('× 3'), 'mensaje incluye cantidad');
  ok(msj.includes('a confirmar') || msj.includes('confirmar'), 'mensaje indica precio a confirmar');
  console.log('   mensaje:\n' + msj.replace(/\n/g, '\n   '));

  console.log(`\n═══ Resumen carrito ═══\n  pasos: ${pasos} · fallos: ${fallos}`);
  await nav.close();
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
