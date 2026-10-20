# Firmador de subidas Cloudinary — ISA ARENAS

Servicio de **firma en servidor** para las subidas de fotos del panel. Sustituye
el preset unsigned (inseguro) por una firma HMAC-SHA1 generada en un
**Cloudflare Worker** aislado y gratuito.

## Cómo funciona
1. El panel (`js/admin.js`) obtiene el **token de Firebase Auth** del admin.
2. El Worker verifica el token (delegado a Firebase `accounts:lookup`) → obtiene el `uid`.
3. El Worker lee `usuarios/{uid}` en Firestore **con el propio token del usuario**
   (las reglas solo permiten leer la ficha propia) → obtiene el `rol`.
4. Solo si `rol` es `isa` o `konfio`, firma los parámetros (`folder` + `timestamp`)
   con el **API Secret de Cloudinary**, que vive únicamente en las variables de
   entorno del Worker (nunca en el navegador ni en el repositorio).
5. El panel sube la foto a Cloudinary con `api_key + timestamp + folder + signature`.

## Estado
- **Desplegado:** `https://isa-arenas-firmador.konfiozinc.workers.dev`
- **Pendiente:** añadir los 2 secretos de Cloudinary (ver abajo).

## Activar (una sola vez, lo hace Darwin)
1. En **Cloudinary Console → Settings → Account → API Keys**, copiar:
   - **API Key** (pública)
   - **API Secret** (secreta)
2. Guardarlas como secretos del Worker:
   ```powershell
   cd firmador
   npx wrangler secret put CLOUDINARY_API_KEY
   npx wrangler secret put CLOUDINARY_API_SECRET
   ```
3. Verificar:
   ```powershell
   # sin token → 401/500 (sin configurar o token inválido)
   Invoke-RestMethod -Uri https://isa-arenas-firmador.konfiozinc.workers.dev -Method Post -ContentType application/json -Body '{"idToken":""}'
   ```

## Restricciones aplicadas
- **Autenticación:** token Firebase válido (verificación criptográfica delegada).
- **Rol:** solo `isa` / `konfio`.
- **Carpeta:** todas las subidas van a `isa-arenas/` (aisladas de otros clientes).
- **Formato/tamaño:** validados en el panel (JPG/PNG/WebP, máx 5 MB) y reforzables
  en el preset de Cloudinary.
- **Frecuencia:** límite suave por IP en el Worker (endurecer con WAF/rate-limit de Cloudflare).

## Costo operativo estimado
- **Cloudflare Workers:** plan gratuito (100 000 solicitudes/día) — sobrado para
  la carga de fotos de un catálogo. **$0.**
- **Cloudinary:** plan gratuito (25 créditos/mes ≈ 25 subidas/mes). **$0** mientras
  ISA no supere ese volumen; si lo supera, se evalúa un plan de pago aparte.

## Seguridad
- El **API Secret de Cloudinary nunca** se expone al navegador ni se versiona.
- Un visitante anónimo, un usuario sin rol o un token caducado son **rechazados**
  en el servidor antes de generar firma alguna.
- Las fotos solo aparecen en el catálogo público cuando el producto se **publica**
  desde el panel (flujo borrador → publicado ya existente).
