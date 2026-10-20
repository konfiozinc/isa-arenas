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
  firma).
- **Roles** (`usuarios/{uid}` con campo `rol`):
  - `isa` → administra su catálogo y publica.
  - `konfio` → igual + lista/gestiona usuarios (superadmin).
- **Reglas** en `firestore.rules`: lectura pública del catálogo publicado;
  escritura solo para administradores autenticados con rol.

## Datos (Firestore)
```
catalogo/borrador  → { config, categorias, productos }   (editable)
catalogo/publico   → { config, categorias, productos }   (publicado)
usuarios/{uid}     → { email, nombre, rol }
```
Producto: `{ id, nombre, categoria, descripcion, precio (null=consultar),
tallas ([]), fotos[], video, destacado, disponible }`.

## Entorno local (emuladores, sin tocar producción)
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
```
Credenciales demo (ficticias, solo emulador):
- ISA → `isa@demo.local` / `DemoIsa2026`
- KONFÍO → `admin@konfiozinc.local` / `DemoKonfio2026`

## Pruebas
```powershell
node herramientas/probar-isa.cjs      # CRUD + publicación + persistencia
node herramientas/probar-carrito.cjs  # carrito, tallas, totales, WhatsApp
node herramientas/probar-acceso.cjs   # roles y acceso no autorizado
node herramientas/capturar-isa.cjs    # capturas móvil/escritorio + panel
```

## Pendiente para publicación (requiere autorización)
1. Crear el proyecto Firebase dedicado de ISA y pegar sus claves públicas en
   `config-isa.js` (marcadores `API_KEY_ISA` / `APP_ID_ISA`) y cambiar
   `modo: 'emulador'` → `'produccion'`.
2. Crear las cuentas de Auth (ISA y KONFÍO) y sus documentos de rol en
   `usuarios/` (script `scripts/crear-usuario.mjs` con Admin SDK, o consola).
3. Desplegar `firestore.rules` (`firebase deploy --only firestore:rules`).
4. Cambiar la URL/repositorio cuando el propietario lo comunique (el código
   usa rutas relativas y una sola constante de WhatsApp; solo se actualiza
   `canonical`/`og:url` y el nombre del repo).

**No se publica nada sin autorización expresa.**
