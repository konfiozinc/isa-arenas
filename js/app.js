/* ═══════════════════════════════════════════════════════════════════
   CALZADOS ISA ARENAS · catálogo público con carrito
   Lee el catálogo publicado desde Firestore (`catalogo/publico`); degrada
   a `content/catalogo.json` si no hay red. El carrito vive en la sesión y
   genera un pedido estructurado para WhatsApp.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = window.CONFIG_ISA || {};
  const WA = (CFG.whatsapp || '573103255067');
  const esEmulador = CFG.modo === 'emulador';

  let db = null, auth = null;
  function initFirestore() {
    try {
      if (typeof firebase === 'undefined') return;
      if (firebase.apps.length === 0) firebase.initializeApp(CFG.firebase || {});
      db = firebase.firestore();
      auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
      if (esEmulador) {
        try { db.useEmulator(CFG.emulador.host, CFG.emulador.firestore); }
        catch (e) { db.settings({ host: CFG.emulador.host + ':' + CFG.emulador.firestore, ssl: false, experimentalForceLongPolling: true }); }
        if (auth) { try { auth.useEmulator('http://' + CFG.emulador.host + ':' + CFG.emulador.auth); } catch (e) {} }
      }
    } catch (e) { db = null; auth = null; }
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function waLink(texto) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(texto); }
  function precio(v) { return v == null || v === '' ? null : Number(v); }
  function precioTexto(v) { const p = precio(v); return p == null ? null : '$' + p.toLocaleString('es-CO'); }
  function tallasDe(p) { return Array.isArray(p.tallas) ? p.tallas : (p.tallas ? String(p.tallas).split(',').map((s) => s.trim()).filter(Boolean) : []); }

  // ── Carrito (sesión) ──
  let carrito = [];
  function cargarCarrito() { try { carrito = JSON.parse(sessionStorage.getItem('isa-carrito') || '[]') || []; } catch (e) { carrito = []; } }
  function guardarCarrito() { try { sessionStorage.setItem('isa-carrito', JSON.stringify(carrito)); } catch (e) {} actualizarCarrito(); }
  function enCarrito(id, talla) { return carrito.find((x) => x.id === id && (x.talla || '') === (talla || '')); }
  function agregar(id, talla, cantidad) {
    const p = productoPorId(id); if (!p) return;
    const ya = enCarrito(id, talla);
    if (ya) ya.cantidad += cantidad; else carrito.push({ id, nombre: p.nombre, precio: precio(p.precio), talla: talla || '', cantidad, foto: (p.fotos && p.fotos[0]) || '' });
    guardarCarrito();
  }
  function cambiarCantidad(id, talla, delta) {
    const x = enCarrito(id, talla); if (!x) return;
    x.cantidad += delta; if (x.cantidad <= 0) carrito = carrito.filter((y) => y !== x);
    guardarCarrito();
  }
  function quitar(id, talla) { carrito = carrito.filter((y) => !(y.id === id && (y.talla || '') === (talla || ''))); guardarCarrito(); }
  function totalCarrito() { return carrito.reduce((s, x) => s + (x.precio || 0) * x.cantidad, 0); }
  function haySinPrecio() { return carrito.some((x) => x.precio == null); }

  function mensajePedido() {
    const marca = (catalogoActual && catalogoActual.config && catalogoActual.config.marca) || 'Calzados ISA Arenas';
    const lineas = carrito.map((x, i) =>
      (i + 1) + '. ' + x.nombre + (x.talla ? ' — Talla ' + x.talla : '') + ' × ' + x.cantidad +
      (x.precio != null ? ' = $' + (x.precio * x.cantidad).toLocaleString('es-CO') : ' (precio a confirmar)'));
    let texto = 'Hola ' + marca + ', quiero hacer este pedido:\n\n' + lineas.join('\n');
    if (!haySinPrecio()) texto += '\n\nTotal: $' + totalCarrito().toLocaleString('es-CO');
    else texto += '\n\n(Algunos precios están por confirmar)';
    return texto;
  }
  function enviarPedido() { if (carrito.length) window.open(waLink(mensajePedido()), '_blank'); }

  // ── Estado de render ──
  let catalogoActual = null;
  let filtroCat = '';
  let detalleProducto = null; let detalleTalla = ''; let detalleCantidad = 1; let idxFoto = 0;

  function productoPorId(id) { return (catalogoActual && catalogoActual.productos || []).find((p) => p.id === id); }
  function catNombre(id) { const c = (catalogoActual && catalogoActual.categorias || []).find((x) => x.id === id); return c ? c.nombre : id; }

  // ── Render principal ──
  function render(catalogo) {
    catalogoActual = catalogo;
    const c = catalogo.config || {};
    document.title = c.marca || 'Calzados ISA Arenas';
    const logo = (c.portada && c.portada.imagen) ? c.portada.imagen : 'logoisa.jpeg';
    const logoEl = $('#logoMarca'); if (logoEl) logoEl.src = logo;
    const nombreEl = $('#marcaNombre'); if (nombreEl) nombreEl.textContent = c.marca || 'Calzados ISA Arenas';
    $$('.js-wa').forEach((a) => { a.href = waLink('Hola ' + (c.marca || 'Calzados ISA Arenas') + ', quiero información de sus productos.'); });

    if (c.portada) {
      const p = c.portada;
      const h = $('#heroTitulo'); if (h) h.textContent = p.titulo || c.marca || '';
      const s = $('#heroSub'); if (s) s.textContent = p.subtitulo || '';
      const t = $('#heroTexto'); if (t) t.textContent = p.texto || '';
      const m = $('#heroMedia'); if (m) m.src = p.imagen || logo;
    }

    // vídeos
    const vids = $('#videos'); if (vids) {
      const lista = (c.videos || []).filter((v) => v.url);
      vids.innerHTML = '';
      vids.parentElement.classList.toggle('hidden', !lista.length);
      lista.forEach((v) => {
        const card = document.createElement('div'); card.className = 'video-card';
        card.innerHTML = '<video controls preload="metadata" playsinline><source src="' + esc(v.url) + '" type="video/mp4"></video><div class="v-body"><h3>' + esc(v.titulo || 'Video') + '</h3></div>';
        vids.appendChild(card);
      });
    }

    // filtros
    const filtros = $('#filtros'); if (filtros) {
      const cats = (catalogo.categorias || []).filter((x) => x.activa !== false);
      filtros.innerHTML = '<button class="filtro activo" data-cat="">Todo</button>' + cats.map((x) => '<button class="filtro" data-cat="' + esc(x.id) + '">' + esc(x.nombre) + '</button>').join('');
      filtros.querySelectorAll('.filtro').forEach((b) => b.addEventListener('click', () => {
        filtros.querySelectorAll('.filtro').forEach((x) => x.classList.remove('activo')); b.classList.add('activo');
        filtroCat = b.dataset.cat; renderProductos();
      }));
    }

    renderProductos();
    actualizarCarrito();
  }

  function renderProductos() {
    const grid = $('#productos'); if (!grid) return;
    const productos = (catalogoActual.productos || [])
      .filter((p) => !filtroCat || p.categoria === filtroCat)
      .sort((a, b) => (a.orden || 99) - (b.orden || 99));
    grid.innerHTML = '';
    if (!productos.length) { grid.innerHTML = '<p style="grid-column:1/-1;color:#6E5A69;text-align:center;padding:30px">No hay productos todavía.</p>'; return; }
    productos.forEach((p) => {
      const foto = (p.fotos && p.fotos[0]) || '';
      const pt = precioTexto(p.precio);
      const ficha = document.createElement('article'); ficha.className = 'ficha';
      ficha.innerHTML =
        '<div class="foto" style="background-image:url(' + esc(foto) + ')">' +
        (p.destacado ? '<div class="badges"><span class="badge destacado">★</span></div>' : '') +
        (!p.disponible ? '<div class="badges"><span class="badge agotado">Agotado</span></div>' : '') + '</div>' +
        '<div class="fbody"><span class="fcat">' + esc(catNombre(p.categoria)) + '</span>' +
        '<span class="fnombre">' + esc(p.nombre) + '</span>' +
        '<span class="fprecio' + (pt ? '' : ' consultar') + '">' + (pt || 'Consultar') + '</span>' +
        '<div class="facciones"><button class="btn-detalle" data-id="' + esc(p.id) + '" ' + (p.disponible === false ? 'disabled' : '') + '>Agregar</button></div></div>';
      ficha.querySelector('.btn-detalle').addEventListener('click', () => abrirDetalle(p));
      grid.appendChild(ficha);
    });
  }

  // ── Detalle ──
  function abrirDetalle(p) {
    detalleProducto = p; idxFoto = 0; detalleCantidad = 1;
    const tallas = tallasDe(p); detalleTalla = tallas[0] || '';
    $('#detTitulo').textContent = p.nombre;
    $('#detCat').textContent = catNombre(p.categoria);
    const pt = precioTexto(p.precio);
    const pr = $('#detPrecio'); pr.textContent = pt || 'Consultar por WhatsApp'; pr.className = 'hoja-precio' + (pt ? '' : ' consultar');
    $('#detTallasInfo').textContent = tallas.length ? 'Tallas: ' + tallas.join(', ') : '';
    $('#detDesc').textContent = p.descripcion || '';

    // selector de talla + cantidad
    const selTallas = $('#detTallas');
    selTallas.innerHTML = '';
    if (tallas.length) {
      selTallas.classList.remove('hidden');
      selTallas.innerHTML = '<span class="lbl">Talla</span><div class="tallas">' + tallas.map((t) => '<button class="talla' + (t === detalleTalla ? ' on' : '') + '" data-talla="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div>';
      selTallas.querySelectorAll('.talla').forEach((b) => b.addEventListener('click', () => { detalleTalla = b.dataset.talla; selTallas.querySelectorAll('.talla').forEach((x) => x.classList.toggle('on', x === b)); }));
    } else selTallas.classList.add('hidden');
    $('#detQty').textContent = detalleCantidad;

    renderCarrusel((p.fotos && p.fotos.length) ? p.fotos : []);
    $('#detalleOverlay').classList.remove('hidden');
  }
  function renderCarrusel(fotos) {
    const stage = $('#detStage'); const dots = $('#detDots');
    stage.innerHTML = fotos.length ? '<img src="' + esc(fotos[0]) + '" alt="">' : '<div style="height:100%;display:grid;place-items:center;color:#6E5A69">Sin fotos todavía</div>';
    dots.innerHTML = '';
    if (fotos.length <= 1) return;
    fotos.forEach((f, i) => {
      const b = document.createElement('button'); if (i === 0) b.className = 'on';
      b.addEventListener('click', () => { idxFoto = i; stage.querySelector('img').src = f; $$('#detDots button').forEach((x, j) => x.className = j === i ? 'on' : ''); });
      dots.appendChild(b);
    });
    $('#detPrev').onclick = () => mover(-1); $('#detNext').onclick = () => mover(1);
    function mover(d) { idxFoto = (idxFoto + d + fotos.length) % fotos.length; stage.querySelector('img').src = fotos[idxFoto]; $$('#detDots button').forEach((x, j) => x.className = j === idxFoto ? 'on' : ''); }
  }
  function cerrarDetalle() { $('#detalleOverlay').classList.add('hidden'); }
  function sumarCantidad(d) { detalleCantidad = Math.max(1, Math.min(99, detalleCantidad + d)); $('#detQty').textContent = detalleCantidad; }
  function agregarDesdeDetalle() {
    if (!detalleProducto) return;
    const tallas = tallasDe(detalleProducto);
    if (tallas.length && !detalleTalla) { abrirCarrito(); return; }
    agregar(detalleProducto.id, tallas.length ? detalleTalla : '', detalleCantidad);
    cerrarDetalle(); abrirCarrito();
  }

  // ── Carrito UI ──
  function actualizarCarrito() {
    const n = carrito.reduce((s, x) => s + x.cantidad, 0);
    const badge = $('#cartCount'); if (badge) { badge.textContent = n; badge.classList.toggle('hidden', n === 0); }
  }
  function abrirCarrito() {
    const caja = $('#carrito'); if (!caja) return;
    caja.innerHTML = '';
    if (!carrito.length) caja.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
    else {
      carrito.forEach((x) => {
        const fila = document.createElement('div'); fila.className = 'cart-item';
        fila.innerHTML =
          '<div class="cart-foto" style="background-image:url(' + esc(x.foto) + ')"></div>' +
          '<div class="cart-info"><div class="cart-nombre">' + esc(x.nombre) + (x.talla ? ' · Talla ' + esc(x.talla) : '') + '</div>' +
          '<div class="cart-precio">' + (x.precio != null ? '$' + x.precio.toLocaleString('es-CO') + ' c/u' : 'Precio a confirmar') + '</div></div>' +
          '<div class="cart-qty"><button data-q="-" data-id="' + esc(x.id) + '" data-talla="' + esc(x.talla) + '">−</button><span>' + x.cantidad + '</span><button data-q="+" data-id="' + esc(x.id) + '" data-talla="' + esc(x.talla) + '">+</button></div>' +
          '<button class="cart-del" data-del data-id="' + esc(x.id) + '" data-talla="' + esc(x.talla) + '">✕</button>';
        caja.appendChild(fila);
      });
      const tot = document.createElement('div'); tot.className = 'cart-total';
      tot.innerHTML = '<span>Total</span><strong>' + (haySinPrecio() ? 'a confirmar' : '$' + totalCarrito().toLocaleString('es-CO')) + '</strong>';
      caja.appendChild(tot);
    }
    $('#carritoOverlay').classList.remove('hidden');
  }
  function cerrarCarrito() { $('#carritoOverlay').classList.add('hidden'); }

  // ── Carga ──
  // La vista previa muestra el borrador SOLO a un administrador autenticado;
  // el público (y un preview anónimo) lee únicamente la versión publicada.
  function esAdminSesion() {
    return new Promise((res) => {
      if (!auth) return res(false);
      const t = setTimeout(() => { unsub(); res(false); }, 4000);
      const unsub = auth.onAuthStateChanged((u) => {
        clearTimeout(t); unsub();
        if (!u) return res(false);
        db.collection('usuarios').doc(u.uid).get()
          .then((s) => res(s.exists && ['isa', 'konfio'].indexOf(s.data().rol) >= 0))
          .catch(() => res(false));
      });
    });
  }
  async function cargar() {
    cargarCarrito();
    initFirestore();
    const esPreview = /[?&]preview=1/.test(location.search);
    const docId = (esPreview && await esAdminSesion()) ? 'borrador' : 'publico';
    let catalogo = null;
    if (db) {
      try {
        const snap = await Promise.race([
          db.collection('catalogo').doc(docId).get(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
        ]);
        if (snap && snap.exists) catalogo = snap.data();
      } catch (e) { catalogo = null; }
    }
    if (!catalogo) {
      try { const r = await fetch('content/catalogo.json'); catalogo = await r.json(); const a = $('#aviso'); if (a) { a.classList.remove('hidden'); a.querySelector('div').textContent = 'Vista con datos de muestra (Firestore no disponible).'; } } catch (e) { catalogo = null; }
    }
    if (catalogo) render(catalogo);
  }

  document.addEventListener('DOMContentLoaded', cargar);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { cerrarDetalle(); cerrarCarrito(); }
    if (e.target.closest('#btnCart')) abrirCarrito();
    if (e.target.closest('#btnEnviarPedido')) enviarPedido();
    if (e.target.closest('#btnAgregar')) agregarDesdeDetalle();
    if (e.target.closest('#detQtyMenos')) sumarCantidad(-1);
    if (e.target.closest('#detQtyMas')) sumarCantidad(1);
    const q = e.target.closest('[data-q]'); if (q) { cambiarCantidad(q.dataset.id, q.dataset.talla, q.dataset.q === '+' ? 1 : -1); renderCarritoTrasCambio(); }
    const del = e.target.closest('[data-del]'); if (del) { quitar(del.dataset.id, del.dataset.talla); renderCarritoTrasCambio(); }
  });
  function renderCarritoTrasCambio() { abrirCarrito(); }
})();
