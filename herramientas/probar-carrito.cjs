'use strict';
/* Prueba comercial del carrito mayorista ISA ARENAS (emuladores).
   Verifica: precios confirmados por par (Planas $24.000 · Altas $30.000 ·
   Caballero $32.000), Altas Cruzadas sin confirmar (= Consultar), mínimo de
   6 pares combinados (5 bloqueado / 6 permitido), combinación de categorías,
   subtotales, total y el mensaje de WhatsApp con precios correctos. */
const { chromium } = require('C:/Users/usuario29/Documents/KONFIO_ZINC/6-LANDING-PAGES/Konfio-Zinc-Web/herramientas/node_modules/playwright');
const BASE = 'http://127.0.0.1:5170/';
let fallos = 0, pasos = 0;
const ok = (c, n, d = '') => { pasos++; if (!c) fallos++; console.log(`  [${c ? 'PASA' : '**FALLA**'}] ${n}${d ? ' — ' + d : ''}`); };

const estadoBoton = () => pag.evaluate(() => ({
  disabled: document.querySelector('#btnEnviarPedido').disabled,
  aviso: !document.querySelector('#cartMinAviso').classList.contains('hidden'),
  avisoTxt: document.querySelector('#cartMinAviso').textContent
}));
let pag;

(async () => {
  const nav = await chromium.launch({ headless: true });
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO' });
  pag = await ctx.newPage();

  // ── 1) precios visibles en el catálogo ──
  await pag.goto(BASE + 'index.html?emulador=1', { waitUntil: 'load' });
  await pag.waitForTimeout(1500);
  const texto = () => pag.evaluate(() => document.body.textContent);
  ok((await texto()).includes('$24.000'), 'precio Planas $24.000 visible');
  ok((await texto()).includes('$30.000'), 'precio Altas $30.000 visible');
  ok((await texto()).includes('$32.000'), 'precio Caballero $32.000 visible');
  ok((await texto()).includes('Consultar'), 'Altas Cruzadas sin precio → "Consultar"');
  ok((await texto()).includes('Ventas exclusivamente al por mayor') && (await texto()).includes('Envío contra entrega'), 'aviso mayorista + envío contra entrega visibles');

  // ── 2) carrito vacío bloqueado ──
  await pag.click('#btnCart'); await pag.waitForTimeout(300);
  let s = await estadoBoton();
  ok(s.disabled === true && !s.aviso, 'carrito vacío: botón bloqueado y sin aviso');
  await pag.click('#carritoOverlay [data-close]'); await pag.waitForTimeout(300);

  // ── 3) 5 pares (Planas) → bloqueado ──
  const abrir = async (nombre, qty) => {
    await pag.evaluate((nm) => { const c = [...document.querySelectorAll('.ficha')].find((x) => x.textContent.includes(nm)); c.querySelector('.btn-detalle').click(); }, nombre);
    await pag.waitForTimeout(400);
    for (let i = 1; i < qty; i++) await pag.click('#detQtyMas');   // 1 → qty
    await pag.click('#btnAgregar');
    await pag.waitForTimeout(500);
  };
  await abrir('Chanclas planas', 5);
  s = await estadoBoton();
  ok(s.disabled === true, '5 pares: botón bloqueado');
  ok(s.aviso === true && /mínimo 6 pares/.test(s.avisoTxt), '5 pares: aviso "mínimo 6 pares"', s.avisoTxt);

  // ── 4) +1 par Caballero (otra categoría) → 6 → permitido ──
  await pag.click('#carritoOverlay [data-close]'); await pag.waitForTimeout(300);
  await abrir('Chanclas caballero', 1);
  s = await estadoBoton();
  ok(s.disabled === false, '6 pares (5 dama + 1 caballero): botón habilitado');
  ok(s.aviso === false, '6 pares: aviso oculto');

  // ── 5) pedido WhatsApp: subtotales + total correctos ──
  await pag.evaluate(() => { window.__waUrl = null; window.open = (u) => { window.__waUrl = u; return null; }; });
  await pag.click('#btnEnviarPedido');
  await pag.waitForTimeout(400);
  const waUrl = await pag.evaluate(() => window.__waUrl || '');
  ok(waUrl.startsWith('https://wa.me/573103255067'), 'pedido va al WhatsApp de ISA');
  const msj = decodeURIComponent(waUrl.split('?text=')[1] || '');
  ok(msj.includes('Chanclas planas') && msj.includes('× 5') && msj.includes('$120.000'), 'subtotal Planas 5 × $24.000 = $120.000');
  ok(msj.includes('Chanclas caballero') && msj.includes('× 1') && msj.includes('$32.000'), 'subtotal Caballero 1 × $32.000');
  ok(msj.includes('Total: $152.000'), 'total general $152.000');
  console.log('   mensaje:\n' + msj.replace(/\n/g, '\n   '));

  // ── 6) reducir por debajo del mínimo → bloqueado de nuevo ──
  const fila = await pag.evaluateHandle(() => [...document.querySelectorAll('.cart-item')].find((x) => x.textContent.includes('Chanclas planas')));
  await fila.asElement().$eval('[data-q="-"]', (b) => b.click());   // 5 → 4 (total 5)
  await pag.waitForTimeout(300);
  s = await estadoBoton();
  ok(s.disabled === true, 'reducir a 4+1 = 5 pares: botón bloqueado de nuevo');

  console.log(`\n═══ Resumen carrito comercial ═══\n  pasos: ${pasos} · fallos: ${fallos}`);
  await nav.close();
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
