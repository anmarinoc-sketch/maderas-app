# Maderas App

Identificación de especies de madera a partir de una fotografía del corte transversal,
para profesionales del sector: aserraderos, carpintería, control de calidad y verificación
de suministro.

```
App Android  ──foto──▶  backend  ──foto + prompt──▶  Gemini
             ◀─JSON──            ◀──JSON estructurado──
```

| Carpeta | Qué es |
| --- | --- |
| [`android/`](android) | App Android (Kotlin + Jetpack Compose). Su README explica cómo obtener el APK. |
| [`backend/`](backend) | Servidor Node.js + Express que custodia la clave de Gemini. Su README documenta la API. |

## Por qué hay un backend

La clave de la API de Gemini **no puede vivir dentro del APK**: cualquiera puede
descompilar una app y extraerla. El backend la guarda en una variable de entorno del
servidor y la app solo conoce la URL pública. Si algún día hay que rotar la clave, se
cambia en un sitio y ningún usuario necesita actualizar nada.

## Puesta en marcha rápida

**Backend en local:**

```bash
cd backend; npm install; copy .env.example .env
```

Pon tu clave de [AI Studio](https://aistudio.google.com/apikey) en `.env` y arranca con
`npm run dev`. Detalles en [backend/README.md](backend/README.md).

**APK:** lo compila GitHub Actions en cada push. Descárgalo desde la pestaña
**Actions**, o crea una etiqueta `vX.Y.Z` para que se publique como release instalable
desde el móvil. Detalles en [android/README.md](android/README.md).

## Configuración del repositorio

En **Settings → Secrets and variables → Actions**:

| Tipo | Nombre | Para qué |
| --- | --- | --- |
| Variable | `BASE_URL` | URL pública del backend. Se compila dentro del APK. |
| Secret | `APP_API_KEY` | Secreto compartido app ↔ backend. Debe coincidir con el del servidor. |

La `GEMINI_API_KEY` **no se configura aquí**: solo existe en el entorno del servidor
desplegado y en el `.env` local, que está en `.gitignore`.

## Despliegue del backend

Hay dos caminos preparados:

- **Cloud Run** — con el [`backend/Dockerfile`](backend/Dockerfile). Escala a cero, arranque
  en frío de pocos segundos y capa gratuita amplia. Al configurar el despliegue continuo hay
  que indicar `backend` como directorio de contexto.
- **Render** — con [`render.yaml`](render.yaml). No pide tarjeta, pero el plan
  gratuito duerme el servicio tras 15 minutos de inactividad.

En cuanto el backend sea público, define `APP_API_KEY` en el servidor: sin él, cualquiera
que descubra la URL puede consumir tu cuota de Gemini.
