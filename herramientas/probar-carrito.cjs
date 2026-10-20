'use strict';
/* Prueba del carrito mayorista de CALZADOS ISA ARENAS (emuladores).
   Verifica: mínimo de 6 pares (carrito vacío, 5 = bloqueado, 6 = permitido,
   cantidades mixtas y reducir por debajo del mínimo), tallas, totales y el
   pedido estructurado por WhatsApp. */
const { chromium } = require('C:/Users/usuario29/Documents/KONFIO_ZINC/6-LANDING-PAGES/Konfio-Zinc-Web/herramientas/node_modules/playwright');
const BASE = 'http://127.0.0.1:5170/';
let fallos = 0, pasos = 0;
const ok = (c, n, d = '') => { pasos++; if (!c) fallos++; console.log(`  [${c ? 'PASA' : '**FALLA**'}] ${n}${d ? ' — ' + d : ''}`); };

const estadoBoton = () => pag.evaluate(() => ({
  disabled: document.querySelector('#btnEnviarPedido').disabled,
  aviso: !document.querySelector('#cartMinAviso').classList.contains('hidden'),
  avisoTxt: document.querySelector('#cartMinAviso').textContent
}));

let pag; // referencia global para estadoBoton

(async () => {
  const nav = await chromium.launch({ headless: true });
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO' });
  pag = await ctx.newPage();

  // ── 1) preparar datos (admin): producto con tallas+precio, "planas" agotado ──
  await pag.goto(BASE + 'admin.html?emulador=1', { waitUntil: 'load' });
  await pag.waitForTimeout(700);
  await pag.fill('#email', 'isa@demo.local'); await pag.fill('#password', 'DemoIsa2026'); await pag.click('#btnLogin');
  await pag.waitForTimeout(1400);
  await pag.click('#btnNuevoProducto'); await pag.waitForTimeout(300);
  await pag.fill('#f-nombre', 'Chanclas niña rosa');
  await pag.selectOption('#f-categoria', await pag.evaluate(() => { const o = [...document.querySelectorAll('#f-categoria option')].find((x) => x.textContent === 'Dama'); return o.value; }));
  await pag.fill('#f-precio', '25000');
  await pag.fill('#f-tallas', '25, 26, 27');
  await pag.click('#btnGuardarProducto'); await pag.waitForTimeout(900);
  await pag.evaluate(() => { const c = [...document.querySelectorAll('.pcard')].find((x) => x.textContent.includes('Chanclas planas')); c.querySelector('[data-act="disponible"]').click(); });
  await pag.waitForTimeout(800);
  await pag.click('#btnPublish'); await pag.waitForTimeout(1200);

  // ── 2) sitio público ──
  await pag.goto(BASE + 'index.html?emulador=1', { waitUntil: 'load' });
  await pag.waitForTimeout(1200);
  ok(await pag.evaluate(() => document.body.textContent.includes('Chanclas niña rosa')), 'producto nuevo visible');
  ok(await pag.evaluate(() => document.body.textContent.includes('25.000')), 'precio $25.000 visible');
  const agotadoDeshabilitado = await pag.evaluate(() => { const c = [...document.querySelectorAll('.ficha')].find((x) => x.textContent.includes('Chanclas planas')); return c.querySelector('.btn-detalle').disabled; });
  ok(agotadoDeshabilitado, 'producto agotado no se puede agregar');

  // ── 3) carrito VACÍO: botón bloqueado y sin aviso ──
  await pag.click('#btnCart'); await pag.waitForTimeout(300);
  let s = await estadoBoton();
  ok(s.disabled === true && !s.aviso, 'carrito vacío: botón de pedido bloqueado y sin aviso');
  await pag.click('#carritoOverlay [data-close]'); await pag.waitForTimeout(300);

  // ── 4) 5 pares → bloqueado ──
  await pag.evaluate(() => { const c = [...document.querySelectorAll('.ficha')].find((x) => x.textContent.includes('Chanclas niña rosa')); c.querySelector('.btn-detalle').click(); });
  await pag.waitForTimeout(400);
  await pag.click('.talla[data-talla="26"]');
  for (let i = 0; i < 4; i++) await pag.click('#detQtyMas');   // cantidad 1 → 5
  await pag.click('#btnAgregar');
  await pag.waitForTimeout(500);
  s = await estadoBoton();
  ok(s.disabled === true, '5 pares: botón de pedido bloqueado');
  ok(s.aviso === true && /mínimo 6 pares/.test(s.avisoTxt), '5 pares: aviso "mínimo 6 pares" visible', s.avisoTxt);

  // ── 5) agregar otro producto (cantidad mixta) → 6 pares → permitido ──
  await pag.click('#carritoOverlay [data-close]'); await pag.waitForTimeout(300);
  await pag.evaluate(() => { const c = [...document.querySelectorAll('.ficha')].find((x) => x.textContent.includes('Chanclas altas')); c.querySelector('.btn-detalle').click(); });
  await pag.waitForTimeout(300);
  await pag.click('#btnAgregar');   // +1 par sin precio (a confirmar)
  await pag.waitForTimeout(500);
  s = await estadoBoton();
  ok(s.disabled === false, '6 pares (5 + 1): botón de pedido habilitado');
  ok(s.aviso === false, '6 pares: aviso oculto');

  // ── 6) reducir por debajo del mínimo → bloqueado de nuevo ──
  const filaNina = await pag.evaluateHandle(() => [...document.querySelectorAll('.cart-item')].find((x) => x.textContent.includes('Chanclas niña rosa')));
  await filaNina.asElement().$eval('[data-q="-"]', (b) => b.click());   // 5 → 4 (total 5)
  await pag.waitForTimeout(300);
  s = await estadoBoton();
  ok(s.disabled === true, 'reducir a 4+1 = 5 pares: botón bloqueado de nuevo');
  ok(s.aviso === true, 'reducir por debajo del mínimo: aviso visible');

  // ── 7) volver a 6 y enviar pedido ──
  const filaNina2 = await pag.evaluateHandle(() => [...document.querySelectorAll('.cart-item')].find((x) => x.textContent.includes('Chanclas niña rosa')));
  await filaNina2.asElement().$eval('[data-q="+"]', (b) => b.click());   // 4 → 5 (total 6)
  await pag.waitForTimeout(300);
  s = await estadoBoton();
  ok(s.disabled === false, 'volver a 6 pares: botón habilitado');

  await pag.evaluate(() => { window.__waUrl = null; window.open = (u) => { window.__waUrl = u; return null; }; });
  await pag.click('#btnEnviarPedido');
  await pag.waitForTimeout(400);
  const waUrl = await pag.evaluate(() => window.__waUrl || '');
  ok(waUrl.startsWith('https://wa.me/573103255067'), 'pedido va al WhatsApp de ISA');
  const msj = decodeURIComponent(waUrl.split('?text=')[1] || '');
  ok(msj.includes('Chanclas niña rosa'), 'mensaje incluye referencia');
  ok(msj.includes('Talla 26'), 'mensaje incluye talla');
  ok(msj.includes('× 5'), 'mensaje incluye cantidad del producto con precio');
  ok(msj.includes('Chanclas altas') && msj.includes('× 1'), 'mensaje incluye el segundo producto (mixto)');
  ok(msj.includes('a confirmar') || msj.includes('confirmar'), 'mensaje indica precio a confirmar');
  console.log('   mensaje:\n' + msj.replace(/\n/g, '\n   '));

  console.log(`\n═══ Resumen carrito mayorista ═══\n  pasos: ${pasos} · fallos: ${fallos}`);
  await nav.close();
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
