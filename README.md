# Calzados ISA Arenas — Catálogo digital

Catálogo tipo boutique para **CALZADOS ISA ARENAS** (WhatsApp 310 325 5067),
reconstruido sobre el proyecto DTA Chanclas. Sitio público estático (GitHub
Pages) + panel de administración con **Firebase Auth + Firestore** (persistencia
real, roles separados).

## Identidad
- Paleta tomada del logo: **rosa `#FC95DE`** y **turquesa `#8AC8D7`**.
- Logo: `logoisa.jpeg` (raíz).
- Vídeos: `variedades.mp4`, `pasosparavender.mp4`, `mejorproveedor.mp4`.
- Las fotografías de DTA se conservan como **material provisional** hasta que
  ISA entregue las definitivas (los precios/tallas se muestran «consultar»).

## Arquitectura
- **Sitio público** (`index.html`, `js/app.js`, `css/styles.css`): lee
  `catalogo/publico` de Firestore; si no hay red, degrada a
  `content/catalogo.json`.
- **Panel** (`admin.html`, `js/admin.js`): edita `catalogo/borrador` y publica
  copiándolo a `catalogo/publico`. Subida de fotos por Cloudinary (preset sin
  firma, solo accesible desde el panel autenticado).
- **Roles** (`usuarios/{uid}` con campo `rol`):
  - `isa` → administra su catálogo y publica.
  - `konfio` → igual + lista/gestiona usuarios (superadmin).
- **Reglas** en `firestore.rules`: lectura pública del catálogo publicado;
  escritura solo para administradores autenticados con rol. Verificadas con
  `herramientas/probar-reglas.cjs` (11 accesos autorizados/denegados).
- **Vista previa**: `index.html?preview=1` muestra el borrador SOLO a un
  administrador con sesión iniciada; para el público lee únicamente lo
  publicado.

## Datos (Firestore)
```
catalogo/borrador  → { config, categorias, productos }   (editable)
catalogo/publico   → { config, categorias, productos }   (publicado)
usuarios/{uid}     → { email, nombre, rol }
```
Producto: `{ id, nombre, categoria, descripcion, precio (null=consultar),
tallas ([]), fotos[], video, destacado, disponible }`.

## Entorno local (emuladores, sin tocar producción)
Por defecto el proyecto apunta a **producción** (`modo: 'produccion'`). Para
desarrollo/pruebas locales se usan los emuladores añadiendo `?emulador=1` a la
URL (o las pruebas ya lo hacen por ti).
```powershell
# 1) Requisitos: Node.js · firebase-tools (ya instalado) · Java (JBR de Android Studio)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# 2) Emuladores Auth + Firestore
node "C:\Users\usuario29\AppData\Roaming\npm\node_modules\firebase-tools\lib\bin\firebase.js" emulators:start --only firestore,auth

# 3) Sembrar usuarios demo + catálogo inicial
node scripts/sembrar-emulador.mjs

# 4) Servir el sitio (otra terminal)
node herramientas/servir.js 5170
#    → abre http://127.0.0.1:5170/index.html?emulador=1
```
Credenciales demo (ficticias, solo emulador):
- ISA → `isa@demo.local` / `DemoIsa2026`
- KONFÍO → `admin@konfiozinc.local` / `DemoKonfio2026`

## Pruebas
```powershell
node herramientas/probar-reglas.cjs        # reglas: accesos autorizados/denegados (emulador)
node herramientas/probar-isa.cjs           # CRUD + publicación + persistencia (emulador)
node herramientas/probar-carrito.cjs       # carrito, tallas, totales, WhatsApp (emulador)
node herramientas/probar-acceso.cjs        # roles y acceso no autorizado (emulador)
node herramientas/probar-produccion.mjs    # conexión REAL: apiKey + reglas desplegadas (producción)
node herramientas/capturar-isa.cjs         # capturas móvil/escritorio + panel (emulador)
```

## Cloudinary (subida de fotos)
La subida usa un preset **sin firma** (adecuado para sitio estático sin backend).
La integridad del catálogo no depende de Cloudinary: solo un admin autenticado
puede guardar la URL en Firestore.

El código apunta al preset **dedicado `isa-arenas`** (aislado del de otros
clientes). Hay que crearlo en la consola de Cloudinary con estas restricciones:

1. **Cloudinary Console → Settings → Upload → Add upload preset**
   - Nombre: `isa-arenas`
   - Signing Mode: **Unsigned**
   - **Folder**: `isa-arenas`
   - **Allowed formats**: solo imágenes (`jpg`, `png`, `webp`)
   - **Max file size**: `5 MB` (coincide con el límite del panel)
   - (Opcional) Incoming transformation para recomprimir.

> Importante: un preset *unsigned* no puede impedir del todo que un tercero
> suba (cualquiera con el nombre del preset puede hacer POST). Las restricciones
> limitan el alcance (carpeta/formatos/peso). Para **bloquear anónimos por
> completo** se necesita firma firmada (backend/Cloud Function), que implicaría
> el plan Blaze (fuera de alcance). La protección real del contenido la dan las
> reglas de Firestore: solo un admin puede publicar la URL.

## Puesta en marcha (producción)
1. ✅ Proyecto `isa-arenas` (Spark) y `config-isa.js` con las claves reales;
   `modo:'produccion'`.
2. ✅ Reglas desplegadas (`firebase deploy --only firestore:rules`) y verificadas
   en producción con `probar-produccion.mjs`.
3. ⏳ Crear las cuentas de Auth (ISA y KONFÍO) y su rol en `usuarios/{uid}`.
   Sin contraseñas en el repo: en Firebase Console (Authentication → Add user;
   luego Firestore → `usuarios/<UID>` con `{ email, nombre, rol }`), o con
   `scripts/crear-usuario.mjs` en local.
4. ⏳ Crear el preset Cloudinary `isa-arenas` (ver sección anterior).
5. ⏳ Desplegar GitHub Pages SOLO con autorización del propietario (sin push a
   `main` hasta entonces).

**No se publica nada sin autorización expresa.**
