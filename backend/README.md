# madera-backend

Backend ligero (Node.js + Express) que recibe la foto del corte transversal desde la app
Android, la envía a Gemini con un prompt de rol experto en dendrología y devuelve un JSON
estructurado. La `GEMINI_API_KEY` vive solo en el servidor: nunca se compila en el APK.

```
App Android  ──imagen──▶  este backend  ──imagen + prompt──▶  Gemini
             ◀──JSON───                 ◀──JSON estructurado──
```

## Puesta en marcha

```bash
npm install
```

Copia `.env.example` a `.env` y pon tu clave de [Google AI Studio](https://aistudio.google.com/apikey):

```bash
cp .env.example .env
```

```bash
npm run dev
```

`npm start` para modo normal. El servidor avisa y sale si falta `GEMINI_API_KEY`.

Comprobación rápida:

```bash
curl http://localhost:3000/health
```

## Endpoint

### `POST /api/identificar-madera`

Acepta la imagen de dos formas:

**multipart/form-data** (lo natural desde Android), campo `imagen`:

```bash
curl -X POST http://localhost:3000/api/identificar-madera -F "imagen=@roble.jpg"
```

**application/json** con base64 (acepta también data URL):

```bash
curl -X POST http://localhost:3000/api/identificar-madera -H "Content-Type: application/json" -d "{\"imagen_base64\":\"/9j/4AAQSk...\"}"
```

Si defines `APP_API_KEY` en `.env`, añade la cabecera `X-App-Key: <valor>`.

### Respuesta correcta (200)

```json
{
  "ok": true,
  "request_id": "0f4c…",
  "modelo": "gemini-3.6-flash",
  "latencia_ms": 3820,
  "imagen": { "mime_type": "image/jpeg", "bytes": 412330 },
  "uso": { "promptTokenCount": 1290, "candidatesTokenCount": 470, "totalTokenCount": 1760 },
  "resultado": {
    "identificacion_posible": true,
    "calidad_imagen": "media",
    "caracteristicas_anatomicas": {
      "porosidad": "Anillada, con poros de leño temprano muy grandes en fila",
      "vasos_poros": "Vasos grandes solitarios con tílides abundantes",
      "parenquima_axial": "Apotraqueal difuso, escaso",
      "radios": "Radios anchos multiseriados muy visibles a simple vista",
      "anillos_crecimiento": "Nítidos, transición abrupta entre leño temprano y tardío",
      "color_albura_duramen": "Albura clara amarillenta, duramen pardo",
      "figura_veteado": "Espejuelos marcados por los radios anchos",
      "otros_rasgos": ["Marcas de sierra en la testa"]
    },
    "nombre_comun": "Roble",
    "nombres_comunes_alternativos": ["Roble blanco europeo", "Carballo"],
    "nombre_cientifico": "Quercus sp.",
    "familia": "Fagaceae",
    "confianza": 0.72,
    "alternativas": [
      {
        "nombre_comun": "Castaño",
        "nombre_cientifico": "Castanea sativa",
        "familia": "Fagaceae",
        "confianza": 0.18,
        "motivo": "También porosidad anillada, pero carece de radios anchos"
      }
    ],
    "usos_habituales": ["Tonelería", "Suelos", "Carpintería de armar"],
    "limitaciones": ["Separar Quercus robur de Q. petraea exige anatomía microscópica"],
    "recomendaciones_captura": ["Lijar la testa hasta grano 400", "Luz rasante lateral"]
  }
}
```

El esquema de salida es fijo (`responseSchema` en `src/lib/prompt.js`), así que la app siempre
recibe los mismos campos. Cuando un dato no se puede determinar, el modelo escribe
`"desconocido"` o `"no visible"` en lugar de omitir el campo — cómodo para mapear a data
classes de Kotlin sin nulos por todas partes.

### Respuesta de error

Todos los errores comparten forma, y `codigo` es estable para hacer un `when` en Kotlin:

```json
{
  "ok": false,
  "request_id": "0f4c…",
  "error": {
    "codigo": "CUOTA_EXCEDIDA",
    "mensaje": "Se alcanzó el límite de cuota de Gemini (nivel gratuito).",
    "detalle": "El nivel gratuito limita peticiones por minuto y por día…"
  }
}
```

| HTTP | `codigo`                | Cuándo ocurre                                              |
| ---- | ----------------------- | ---------------------------------------------------------- |
| 400  | `SIN_IMAGEN`            | No llegó ni `imagen` ni `imagen_base64`                      |
| 400  | `IMAGEN_INVALIDA`       | El contenido no es una imagen (validado por *magic bytes*)   |
| 400  | `MULTIPART_INVALIDO`    | Campo equivocado o más de un archivo                         |
| 400  | `JSON_INVALIDO`         | Cuerpo JSON mal formado                                      |
| 401  | `NO_AUTORIZADO`         | `X-App-Key` ausente o incorrecta (solo si hay `APP_API_KEY`) |
| 413  | `IMAGEN_MUY_GRANDE`     | Supera `MAX_IMAGE_MB`                                        |
| 415  | `FORMATO_NO_SOPORTADO`  | Imagen real distinta de JPEG/PNG/WEBP/HEIC/HEIF              |
| 422  | `CONTENIDO_BLOQUEADO`   | Filtros de seguridad de Gemini                               |
| 429  | `DEMASIADAS_SOLICITUDES`| Rate limit de este backend (cabecera `Retry-After`)          |
| 429  | `CUOTA_EXCEDIDA`        | Límite de cuota de Gemini — **nivel gratuito**               |
| 502  | `CREDENCIAL_INVALIDA`   | `GEMINI_API_KEY` mal configurada en el servidor              |
| 502  | `MODELO_NO_DISPONIBLE`  | El modelo de `GEMINI_MODEL` no existe para esa clave         |
| 502  | `RESPUESTA_INVALIDA`    | Gemini devolvió algo que no es JSON del esquema              |
| 503  | `SERVICIO_NO_DISPONIBLE`| Gemini caído o saturado                                      |
| 504  | `TIEMPO_AGOTADO`        | Superado `GEMINI_TIMEOUT_MS`                                 |
| 500  | `ERROR_INTERNO`         | Cualquier otro fallo (detalle solo en logs del servidor)     |

`CUOTA_EXCEDIDA` y `SERVICIO_NO_DISPONIBLE` se reintentan automáticamente en el servidor
(`GEMINI_MAX_RETRIES`, backoff exponencial) antes de devolverse a la app.

## Cómo protege la clave

- La clave se lee de `.env` mediante `dotenv`; `.env` está en `.gitignore` y solo se versiona
  `.env.example`. No aparece en ningún archivo fuente.
- Nunca se incluye en respuestas: los errores de autenticación se traducen a
  `CREDENCIAL_INVALIDA` con un mensaje genérico, y el payload de error de Google se recorta.
- `APP_API_KEY` (opcional pero recomendado en cuanto lo despliegues) impide que un tercero
  use tu servidor como proxy abierto y agote tu cuota.
- El rate limit en memoria por IP amortigua ráfagas y bucles de reintento de la app.

## Consumo desde Android

Retrofit + OkHttp, multipart, comprimiendo antes de subir:

```kotlin
interface MaderaApi {
    @Multipart
    @POST("api/identificar-madera")
    suspend fun identificar(
        @Part imagen: MultipartBody.Part,
        @Header("X-App-Key") appKey: String,
    ): Response<IdentificacionResponse>
}

val parte = MultipartBody.Part.createFormData(
    "imagen",
    "corte.jpg",
    jpegBytes.toRequestBody("image/jpeg".toMediaType()),
)
```

Notas prácticas:

- Comprime a JPEG ~85 % y lado mayor ~1600 px antes de enviar: baja la latencia y el consumo
  de tokens sin perder detalle anatómico útil.
- En emulador, el host es `http://10.0.2.2:3000`. Para tráfico HTTP en claro durante el
  desarrollo necesitarás un `network_security_config.xml` que lo permita; en producción, HTTPS.
- La foto no se guarda en disco en ningún momento: se procesa en memoria y se descarta.

## Estructura

```
src/
  server.js               arranque, timeouts y apagado limpio
  app.js                  montaje de Express, /health, manejo de errores
  config.js               lectura y validación de variables de entorno
  routes/identificar.js   endpoint POST /api/identificar-madera
  lib/gemini.js           llamada a Gemini, reintentos y traducción de errores
  lib/prompt.js           rol de dendrólogo + esquema JSON de salida
  lib/image.js            validación real de la imagen y decodificación base64
  lib/errors.js           AppError y catálogo de errores
  middleware/upload.js    multer en memoria (multipart)
  middleware/auth.js      secreto compartido opcional X-App-Key
  middleware/rateLimit.js límite por IP en memoria
```

## Siguientes pasos sugeridos

- HTTPS y despliegue (Cloud Run, Render o Fly.io encajan bien con este tamaño).
- Rate limit en Redis si escalas a más de una instancia.
- Caché por hash de imagen para no pagar dos veces la misma consulta.
- Registro de identificaciones (sin guardar la foto) para medir aciertos con peritos reales.
