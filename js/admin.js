/* ═══════════════════════════════════════════════════════════════════
   CALZADOS ISA ARENAS · panel de administración
   Firebase Auth (email/contraseña) + Firestore. Roles:
     · isa   → administra su catálogo (borrador) y publica
     · konfio → igual + gestión de usuarios (superadmin)
   Persistencia real en Firestore (`catalogo/borrador` → `catalogo/publico`).
   Nada se guarda en localStorage.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = window.CONFIG_ISA || {};
  const esEmulador = CFG.modo === 'emulador';

  let auth = null, db = null;
  function initFirebase() {
    if (firebase.apps.length === 0) firebase.initializeApp(CFG.firebase || {});
    auth = firebase.auth();
    db = firebase.firestore();
    if (esEmulador) {
      try { auth.useEmulator('http://' + CFG.emulador.host + ':' + CFG.emulador.auth); } catch (e) {}
      try { db.useEmulator(CFG.emulador.host, CFG.emulador.firestore); } catch (e) { db.settings({ host: CFG.emulador.host + ':' + CFG.emulador.firestore, ssl: false, experimentalForceLongPolling: true }); }
    }
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const estado = {
    usuario: null, rol: null, authReady: false,
    email: '', password: '', error: '', ocupado: false,
    tab: 'productos', draft: null, sucio: false,
    categorias: [], productos: [],
    modal: null, editandoId: null, form: {}, guardando: false,
    toast: '', usuarios: []
  };

  function toast(m) { estado.toast = m; clearTimeout(estado._t); estado._t = setTimeout(() => estado.toast = '', 2600); }
  function fmt(v) { return v == null || v === '' ? '—' : '$' + Number(v).toLocaleString('es-CO'); }

  // ── Auth ──
  function login() {
    estado.error = '';
    const email = ($('#email') || {}).value || estado.email;
    const password = ($('#password') || {}).value || estado.password;
    if (!email.trim() || !password) { estado.error = 'Ingresa correo y contraseña.'; render(); return; }
    estado.ocupado = true; render();
    auth.signInWithEmailAndPassword(email.trim(), password)
      .then(() => { estado.password = ''; })
      .catch((e) => { estado.error = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(e.code || '') ? 'Correo o contraseña incorrectos.' : e.message; })
      .finally(() => { estado.ocupado = false; render(); });
  }
  function logout() { auth.signOut(); estado.usuario = null; estado.rol = null; estado.draft = null; estado.usuarios = []; render(); }

  async function cargarRol(uid) {
    try { const s = await db.collection('usuarios').doc(uid).get(); estado.rol = s.exists ? s.data().rol : null; }
    catch (e) { estado.rol = null; }
  }
  async function cargarDatos() {
    // borrador
    let draft = null;
    try { const s = await db.collection('catalogo').doc('borrador').get(); if (s.exists) draft = s.data(); } catch (e) {}
    if (!draft) {
      try { const r = await fetch('content/catalogo.json'); draft = await r.json(); } catch (e) {}
      if (draft) { try { await db.collection('catalogo').doc('borrador').set(draft); } catch (e) {} }
    }
    estado.draft = draft || { config: {}, categorias: [], productos: [] };
    estado.categorias = estado.draft.categorias || [];
    estado.productos = estado.draft.productos || [];
    // usuarios (solo superadmin)
    if (estado.rol === CFG.roles.konfio) {
      try { const s = await db.collection('usuarios').get(); estado.usuarios = s.docs.map((d) => ({ uid: d.id, ...d.data() })); } catch (e) { estado.usuarios = []; }
    }
    render();
  }

  async function persistir() {
    try {
      await db.collection('catalogo').doc('borrador').set({ config: estado.draft.config, categorias: estado.categorias, productos: estado.productos });
      estado.sucio = false; render();
      return true;
    } catch (e) { toast('Error al guardar: ' + e.message); return false; }
  }
  async function publicar() {
    estado.ocupado = true; render();
    try {
      await db.collection('catalogo').doc('publico').set({ config: estado.draft.config, categorias: estado.categorias, productos: estado.productos });
      toast('✓ Catálogo publicado. Ya está visible para el público.');
    } catch (e) { toast('Error al publicar: ' + e.message); }
    estado.ocupado = false; render();
  }

  // ── CRUD productos ──
  function abrirProducto(p) {
    estado.modal = 'producto'; estado.editandoId = p ? p.id : null;
    estado.form = p ? {
      nombre: p.nombre || '', categoria: p.categoria || (estado.categorias[0] && estado.categorias[0].id) || '',
      descripcion: p.descripcion || '', precio: p.precio == null ? '' : p.precio,
      tallas: Array.isArray(p.tallas) ? p.tallas.join(', ') : (p.tallas || ''),
      fotos: Array.isArray(p.fotos) ? p.fotos.slice() : [], video: p.video || '',
      destacado: !!p.destacado, disponible: p.disponible !== false, orden: p.orden || 99
    } : { nombre: '', categoria: (estado.categorias[0] && estado.categorias[0].id) || '', descripcion: '', precio: '', tallas: '', fotos: [], video: '', destacado: false, disponible: true, orden: 99 };
    render();
  }
  async function guardarProducto() {
    const g = (sel) => ($(sel) ? $(sel).value : '');
    const nombre = g('#f-nombre'); const categoria = g('#f-categoria'); const descripcion = g('#f-desc');
    const precio = g('#f-precio'); const tallas = g('#f-tallas'); const video = g('#f-video');
    const destacado = $('#f-destacado') ? $('#f-destacado').checked : false;
    const disponible = $('#f-disponible') ? $('#f-disponible').checked : true;
    if (!nombre.trim()) { toast('El nombre es obligatorio'); return; }
    const datos = {
      nombre: nombre.trim(), categoria, descripcion: descripcion.trim(),
      precio: precio === '' ? null : Number(precio) || 0,
      tallas: tallas.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean),
      fotos: estado.form.fotos, video: video.trim(),
      destacado, disponible
    };
    if (estado.editandoId) { const i = estado.productos.findIndex((x) => x.id === estado.editandoId); if (i >= 0) estado.productos[i] = { id: estado.editandoId, ...datos }; }
    else { estado.productos.push({ id: 'p' + Date.now().toString(36), ...datos }); }
    estado.guardando = false; estado.sucio = true; estado.modal = null;
    await persistir();
  }
  function eliminarProducto(id) {
    const p = estado.productos.find((x) => x.id === id);
    if (!confirm('¿Eliminar "' + p.nombre + '"?')) return;
    estado.productos = estado.productos.filter((x) => x.id !== id);
    estado.sucio = true; persistir();
  }
  function toggleProducto(id, campo) {
    const p = estado.productos.find((x) => x.id === id); if (!p) return;
    p[campo] = !p[campo]; estado.sucio = true; persistir();
  }

  // ── CRUD categorías ──
  function abrirCategoria(c) {
    estado.modal = 'categoria'; estado.editandoId = c ? c.id : null;
    estado.form = c ? { nombre: c.nombre, orden: c.orden || 1, activa: c.activa !== false } : { nombre: '', orden: estado.categorias.length + 1, activa: true };
    render();
  }
  async function guardarCategoria() {
    const nombre = ($('#c-nombre') || {}).value || '';
    const orden = Number(($('#c-orden') || {}).value) || 1;
    const activa = $('#c-activa') ? $('#c-activa').checked : true;
    if (!nombre.trim()) { toast('El nombre es obligatorio'); return; }
    const datos = { nombre: nombre.trim(), orden, activa };
    if (estado.editandoId) { const i = estado.categorias.findIndex((x) => x.id === estado.editandoId); if (i >= 0) estado.categorias[i] = { id: estado.editandoId, ...datos }; }
    else estado.categorias.push({ id: 'c' + Date.now().toString(36), ...datos });
    estado.sucio = true; estado.modal = null; await persistir();
  }
  function eliminarCategoria(id) {
    const usada = estado.productos.some((p) => p.categoria === id);
    if (usada) { toast('No se puede borrar: tiene productos asignados.'); return; }
    if (!confirm('¿Eliminar esta categoría?')) return;
    estado.categorias = estado.categorias.filter((x) => x.id !== id);
    estado.sucio = true; persistir();
  }

  // ── Contenido (portada + vídeos) ──
  function abrirContenido() { estado.modal = 'contenido'; estado.form = JSON.parse(JSON.stringify(estado.draft.config || {})); estado.form.videos = estado.form.videos || []; render(); }
  async function guardarContenido() {
    estado.draft.config = {
      marca: estado.form.marca, eslogan: estado.form.eslogan, whatsapp: estado.form.whatsapp, telefono: estado.form.telefono, ubicacion: estado.form.ubicacion || '',
      portada: estado.form.portada || { titulo: '', subtitulo: '', texto: '', imagen: '' },
      videos: estado.form.videos || []
    };
    estado.sucio = true; estado.modal = null; await persistir();
  }

  // ── Fotos (Cloudinary) ──
  // Subida con preset SIN FIRMA (apto para sitio estático). La integridad del
  // catálogo NO depende de Cloudinary: solo un admin autenticado puede guardar
  // la URL en Firestore (reglas `catalogo/*` → esAdmin()). Para evitar abuso
  // de cuota del preset compartido, restringirlo en la consola de Cloudinary
  // (Settings → Upload → presets): carpeta, formatos (jpg/png/webp) y tamaño.
  function agregarFoto(ev) {
    const file = ev.target.files[0]; if (!file) return;
    if (!estado.usuario) { toast('Sesión expirada: vuelve a entrar.'); render(); return; }
    if (!file.type.startsWith('image/')) { toast('Selecciona una imagen válida'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Imagen muy grande (máx 5 MB)'); return; }
    estado.guardando = true; render();
    comprimir(file, 1000, 0.82).then((blob) => {
      const fd = new FormData(); fd.append('file', blob, 'producto.jpg'); fd.append('upload_preset', CFG.cloudinary.uploadPreset); fd.append('tags', 'isa-arenas');
      return fetch('https://api.cloudinary.com/v1_1/' + CFG.cloudinary.cloudName + '/image/upload', { method: 'POST', body: fd }).then((r) => r.json());
    }).then((d) => {
      if (!d.secure_url) throw new Error((d.error && d.error.message) || 'No se pudo subir');
      estado.form.fotos.push(d.secure_url); estado.guardando = false; toast('✓ Foto agregada'); render();
    }).catch((e) => { estado.guardando = false; toast('Error: ' + e.message); render(); });
  }
  function quitarFoto(i) { estado.form.fotos.splice(i, 1); render(); }
  function comprimir(file, maxW, q) {
    return new Promise((res, rej) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, maxW / img.width); const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); c.toBlob((b) => b ? res(b) : rej(new Error('No se pudo procesar')), 'image/jpeg', q);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Imagen inválida')); };
      img.src = url;
    });
  }

  // ── Vista previa ──
  function vistaPrevia() {
    // abre el catálogo público en modo "borrador" (requiere sesión admin)
    window.open('index.html?preview=1', '_blank');
  }

  // ── Render ──
  function render() {
    const raiz = $('#app'); if (!raiz) return;
    raiz.innerHTML =
      (estado.usuario ? vistaDashboard() : vistaLogin());
    enlazar();
  }
  function vistaLogin() {
    return '<div class="login-wrap"><div class="login-card">' +
      '<div class="login-logo">👠</div><h1>ISA ARENAS · Panel</h1><p class="sub">Ingresa con tu correo y contraseña</p>' +
      (estado.error ? '<div class="error-msg">' + esc(estado.error) + '</div>' : '') +
      '<div class="field"><label>Correo</label><input id="email" type="email" autocomplete="username" placeholder="admin@isa.com"></div>' +
      '<div class="field"><label>Contraseña</label><input id="password" type="password" autocomplete="current-password" placeholder="••••••••"></div>' +
      '<button class="btn btn-primary btn-block" id="btnLogin" ' + (estado.ocupado ? 'disabled' : '') + '>' + (estado.ocupado ? 'Entrando…' : 'Entrar') + '</button>' +
      '</div></div>';
  }
  function vistaDashboard() {
    const rolNombre = estado.rol === CFG.roles.konfio ? 'KONFÍO ZINC · superadmin' : (estado.rol === CFG.roles.isa ? 'ISA ARENAS · admin' : 'sin rol');
    const tabs = [['productos', 'Productos'], ['categorias', 'Categorías'], ['contenido', 'Contenido']];
    if (estado.rol === CFG.roles.konfio) tabs.push(['usuarios', 'Usuarios']);
    const botones = tabs.map(([id, nombre]) => '<button class="tab' + (estado.tab === id ? ' activo' : '') + '" data-tab="' + id + '">' + nombre + '</button>').join('');

    let cuerpo = '';
    if (estado.tab === 'productos') cuerpo = tabProductos();
    else if (estado.tab === 'categorias') cuerpo = tabCategorias();
    else if (estado.tab === 'contenido') cuerpo = tabContenido();
    else if (estado.tab === 'usuarios') cuerpo = tabUsuarios();

    const modal = estado.modal ? vistaModal() : '';

    return '<header class="app-head"><div class="t"><span class="dot"></span>Calzados ISA Arenas</div>' +
      '<div class="rol">' + rolNombre + '</div><button id="btnLogout">Salir</button></header>' +
      '<div class="wrap">' +
      '<div class="topbar"><div class="tabs">' + botones + '</div>' +
      '<div class="acciones"><button class="btn btn-ghost" id="btnPreview">👁 Vista previa</button>' +
      '<button class="btn btn-primary" id="btnPublish" ' + (estado.ocupado ? 'disabled' : '') + '>' + (estado.ocupado ? 'Publicando…' : 'Publicar') + '</button></div></div>' +
      (estado.sucio ? '<div class="sucia">Hay cambios sin publicar.</div>' : '') +
      cuerpo +
      '</div>' + modal +
      '<div class="toast' + (estado.toast ? ' show' : '') + '">' + esc(estado.toast) + '</div>';
  }

  function tabProductos() {
    const q = estado.busqueda || '';
    const lista = estado.productos.filter((p) => (!q || (p.nombre || '').toLowerCase().includes(q.toLowerCase())));
    const filas = lista.map((p) => {
      const cat = (estado.categorias.find((c) => c.id === p.categoria) || {}).nombre || p.categoria;
      const foto = p.fotos && p.fotos[0] ? 'url(' + p.fotos[0] + ')' : '';
      return '<div class="pcard" data-id="' + p.id + '">' +
        '<div class="pimg" style="background-image:' + foto + '"></div>' +
        '<div class="pinfo"><div class="pname">' + esc(p.nombre) + (p.destacado ? ' <span class="star">★</span>' : '') + '</div>' +
        '<div class="pcat">' + esc(cat) + '</div>' +
        '<div class="pmeta"><span class="price">' + fmt(p.precio) + '</span>' +
        (p.tallas ? '<span class="badge tallas">' + esc(p.tallas) + '</span>' : '') +
        (!p.disponible ? '<span class="badge agotado">Agotado</span>' : '') + '</div></div>' +
        '<div class="pactions"><button data-act="destacado" title="Destacado">★</button><button data-act="disponible" title="Disponible">👁</button><button data-act="editar" title="Editar">✎</button><button class="del" data-act="eliminar" title="Eliminar">🗑</button></div></div>';
    }).join('');
    return '<div class="search"><input id="buscar" placeholder="Buscar producto…" value="' + esc(q) + '"></div>' +
      '<div class="count">' + lista.length + ' productos</div>' +
      '<div class="list">' + (filas || '<div class="empty">No hay productos.</div>') + '</div>' +
      '<button class="fab" id="btnNuevoProducto">+</button>';
  }
  function tabCategorias() {
    const filas = estado.categorias.map((c) =>
      '<div class="pcard" data-id="' + c.id + '"><div class="pinfo"><div class="pname">' + esc(c.nombre) + (c.activa === false ? ' <span class="badge agotado">Inactiva</span>' : '') + '</div>' +
      '<div class="pcat">orden ' + (c.orden || 1) + ' · ' + estado.productos.filter((p) => p.categoria === c.id).length + ' productos</div></div>' +
      '<div class="pactions"><button data-act="editar" title="Editar">✎</button><button class="del" data-act="eliminar" title="Eliminar">🗑</button></div></div>').join('');
    return '<div class="count">' + estado.categorias.length + ' categorías</div><div class="list">' + (filas || '<div class="empty">No hay categorías.</div>') + '</div><button class="fab" id="btnNuevaCategoria">+</button>';
  }
  function tabContenido() {
    const c = estado.draft.config || {};
    return '<div class="card-resumen"><h3>Portada</h3><p>' + esc(c.portada && c.portada.titulo || 'Sin título') + '</p><p class="sub">' + esc(c.portada && c.portada.subtitulo || '') + '</p>' +
      '<h3 style="margin-top:16px">Vídeos</h3><p>' + ((c.videos || []).map((v) => esc(v.titulo)).join(' · ') || 'Sin vídeos') + '</p>' +
      '<h3 style="margin-top:16px">WhatsApp</h3><p>' + esc(c.whatsapp || CFG.whatsapp) + '</p></div>' +
      '<button class="btn btn-primary" id="btnEditarContenido">Editar contenido</button>';
  }
  function tabUsuarios() {
    const filas = estado.usuarios.map((u) =>
      '<div class="pcard"><div class="pinfo"><div class="pname">' + esc(u.email || u.uid) + '</div><div class="pcat">' + (u.rol === CFG.roles.konfio ? 'KONFÍO ZINC (superadmin)' : 'ISA (admin)') + '</div></div></div>').join('');
    return '<div class="count">' + estado.usuarios.length + ' usuarios</div><div class="list">' + (filas || '<div class="empty">Sin usuarios.</div>') + '</div>' +
      '<p class="sub" style="margin-top:10px">Las cuentas se crean con el script <code>scripts/crear-usuario.mjs</code> (Auth emulator en local; Firebase Admin al desplegar).</p>';
  }

  function vistaModal() {
    if (estado.modal === 'producto') {
      const f = estado.form;
      const fotos = f.fotos.map((u, i) => '<div class="foto-item" style="background-image:url(' + u + ')"><button class="foto-del" data-foto="' + i + '">✕</button></div>').join('');
      const cats = estado.categorias.map((c) => '<option value="' + c.id + '"' + (f.categoria === c.id ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('');
      return '<div class="overlay"><div class="sheet"><div class="sheet-head"><h2>' + (estado.editandoId ? 'Editar producto' : 'Nuevo producto') + '</h2><button data-close>✕</button></div>' +
        '<div class="field"><label>Fotos</label><div class="fotos-grid">' + fotos + '</div>' +
        '<input type="file" id="fotoFile" accept="image/*">' + (estado.guardando ? '<div style="color:#2E8CA5;margin-top:4px">Subiendo…</div>' : '') + '</div>' +
        '<div class="field"><label>Nombre</label><input id="f-nombre" value="' + esc(f.nombre) + '"></div>' +
        '<div class="field"><label>Categoría</label><select id="f-categoria">' + cats + '</select></div>' +
        '<div class="field"><label>Descripción</label><textarea id="f-desc" rows="2">' + esc(f.descripcion) + '</textarea></div>' +
        '<div class="grid2"><div class="field"><label>Precio (COP)</label><input id="f-precio" type="number" min="0" value="' + (f.precio === '' ? '' : f.precio) + '" placeholder="dejar vacío = consultar"></div>' +
        '<div class="field"><label>Tallas (separadas por coma)</label><input id="f-tallas" value="' + esc(f.tallas) + '" placeholder="Ej: 35, 36, 37, 38"></div></div>' +
        '<div class="field"><label>Video (URL)</label><input id="f-video" value="' + esc(f.video) + '" placeholder="opcional"></div>' +
        '<div class="toggles"><label class="toggle"><span>⭐ Destacado</span><input id="f-destacado" type="checkbox"' + (f.destacado ? ' checked' : '') + '></label>' +
        '<label class="toggle"><span>✅ Disponible</span><input id="f-disponible" type="checkbox"' + (f.disponible ? ' checked' : '') + '></label></div>' +
        '<div class="sheet-foot"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="btnGuardarProducto">Guardar</button></div></div></div>';
    }
    if (estado.modal === 'categoria') {
      const f = estado.form;
      return '<div class="overlay"><div class="sheet"><div class="sheet-head"><h2>' + (estado.editandoId ? 'Editar categoría' : 'Nueva categoría') + '</h2><button data-close>✕</button></div>' +
        '<div class="field"><label>Nombre</label><input id="c-nombre" value="' + esc(f.nombre) + '"></div>' +
        '<div class="grid2"><div class="field"><label>Orden</label><input id="c-orden" type="number" value="' + f.orden + '"></div>' +
        '<div class="field"><label>Activa</label><input id="c-activa" type="checkbox"' + (f.activa ? ' checked' : '') + '></div></div>' +
        '<div class="sheet-foot"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="btnGuardarCategoria">Guardar</button></div></div></div>';
    }
    if (estado.modal === 'contenido') {
      const f = estado.form; const port = f.portada || {};
      const videos = (f.videos || []).map((v, i) =>
        '<div class="grid2"><input data-v="titulo" data-i="' + i + '" value="' + esc(v.titulo) + '" placeholder="Título"><input data-v="url" data-i="' + i + '" value="' + esc(v.url) + '" placeholder="archivo.mp4"></div>').join('');
      return '<div class="overlay"><div class="sheet"><div class="sheet-head"><h2>Contenido</h2><button data-close>✕</button></div>' +
        '<div class="field"><label>Marca</label><input id="g-marca" value="' + esc(f.marca) + '"></div>' +
        '<div class="field"><label>Eslogan</label><input id="g-eslogan" value="' + esc(f.eslogan) + '"></div>' +
        '<div class="grid2"><div class="field"><label>WhatsApp (solo números)</label><input id="g-whatsapp" value="' + esc(f.whatsapp || CFG.whatsapp) + '"></div>' +
        '<div class="field"><label>Teléfono visible</label><input id="g-telefono" value="' + esc(f.telefono) + '"></div></div>' +
        '<h3 class="subh">Portada</h3>' +
        '<div class="field"><label>Título</label><input id="g-titulo" value="' + esc(port.titulo) + '"></div>' +
        '<div class="field"><label>Subtítulo</label><input id="g-subtitulo" value="' + esc(port.subtitulo) + '"></div>' +
        '<div class="field"><label>Texto</label><textarea id="g-texto" rows="2">' + esc(port.texto) + '</textarea></div>' +
        '<div class="field"><label>Imagen de portada</label><input id="g-imagen" value="' + esc(port.imagen) + '" placeholder="logoisa.jpeg"></div>' +
        '<h3 class="subh">Vídeos</h3>' + videos +
        '<div class="sheet-foot"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="btnGuardarContenido">Guardar</button></div></div></div>';
    }
    return '';
  }

  // ── Enlazar eventos ──
  function enlazar() {
    const raiz = $('#app');
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    on('#btnLogin', 'click', login);
    on('#btnLogout', 'click', logout);
    on('#btnPublish', 'click', publicar);
    on('#btnPreview', 'click', vistaPrevia);
    on('#btnNuevoProducto', 'click', () => abrirProducto(null));
    on('#btnNuevaCategoria', 'click', () => abrirCategoria(null));
    on('#btnEditarContenido', 'click', abrirContenido);
    on('#buscar', 'input', (e) => { estado.busqueda = e.target.value; render(); });
    on('#fotoFile', 'change', agregarFoto);
    on('#btnGuardarProducto', 'click', guardarProducto);
    on('#btnGuardarCategoria', 'click', guardarCategoria);
    on('#btnGuardarContenido', 'click', () => {
      const f = estado.form; f.marca = $('#g-marca').value; f.eslogan = $('#g-eslogan').value; f.whatsapp = $('#g-whatsapp').value; f.telefono = $('#g-telefono').value;
      f.portada = { titulo: $('#g-titulo').value, subtitulo: $('#g-subtitulo').value, texto: $('#g-texto').value, imagen: $('#g-imagen').value };
      $$('[data-v="titulo"]').forEach((el) => f.videos[Number(el.dataset.i)].titulo = el.value);
      $$('[data-v="url"]').forEach((el) => f.videos[Number(el.dataset.i)].url = el.value);
      guardarContenido();
    });
    $$('.tab').forEach((b) => b.addEventListener('click', () => { estado.tab = b.dataset.tab; render(); }));
    $$('[data-close]').forEach((b) => b.addEventListener('click', () => { estado.modal = null; render(); }));
    $$('#app .overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) { estado.modal = null; render(); } }));
    $$('.pactions button').forEach((b) => b.addEventListener('click', (e) => {
      const id = b.closest('.pcard').dataset.id; const act = b.dataset.act;
      if (estado.tab === 'productos') {
        if (act === 'eliminar') eliminarProducto(id); else if (act === 'editar') abrirProducto(estado.productos.find((x) => x.id === id)); else toggleProducto(id, act);
      } else if (estado.tab === 'categorias') {
        if (act === 'eliminar') eliminarCategoria(id); else abrirCategoria(estado.categorias.find((x) => x.id === id));
      }
    }));
    $$('.foto-del').forEach((b) => b.addEventListener('click', () => quitarFoto(Number(b.dataset.foto))));
  }

  // ── Boot ──
  initFirebase();
  auth.onAuthStateChanged((u) => {
    estado.usuario = u; estado.authReady = true;
    if (u) { cargarRol(u.uid).then(cargarDatos); }
    else render();
  });
})();
