# XiloScan y BioScan

Dos apps Android para trabajo de campo y comercio de madera en Colombia, y un servidor
que comparten.

> El repositorio se llama `maderas-app` porque nació con la primera. El nombre se quedó;
> dentro hay dos apps.

| App | Qué hace | Dónde |
| --- | --- | --- |
| **XiloScan** | Identifica la **especie de madera** fotografiando el corte transversal | [`android/`](android) |
| **BioScan** | Dice si una **especie de flora o fauna** es nativa, endémica, amenazada o vedada | [`android-bioscan/`](android-bioscan) |
| Servidor | El mismo para las dos | [`backend/`](backend) |

Cada carpeta tiene su propio README con el detalle.

## Por qué comparten servidor

El plan gratuito de Render da **750 horas de instancia al mes por cuenta**, y un servicio
despierto las consume casi todas. Un segundo servicio agotaría la cuota y Render
suspendería **los dos** hasta el mes siguiente. Así que un solo servicio,
`madera-backend.onrender.com`, atiende a las dos apps por rutas distintas.

Lo que sí va separado son las **claves de Gemini**: `GEMINI_API_KEY` para XiloScan y
`GEMINI_API_KEY_ESPECIES` para BioScan, de proyectos distintos de Google Cloud. El nivel
gratuito limita 20 peticiones diarias por modelo **y por proyecto**, así que con una sola
clave un día de identificar especies se comería las identificaciones de madera.

## Por qué hay un backend

La clave de Gemini **no puede vivir dentro del APK**: cualquiera puede descompilar una app
y extraerla. El backend la guarda en una variable de entorno del servidor y la app solo
conoce la URL pública. Si hay que rotar la clave, se cambia en un sitio y nadie tiene que
actualizar nada.

## Las dos filosofías, que no son la misma

**XiloScan** le pregunta a Gemini y calibra la respuesta. La clave de determinación de las
34 maderas del Valle de Aburrá va en el prompt, y la confianza está forzada a una escala
explícita porque sin eso decía 0,93 tanto al acertar como al fallar.

**BioScan hace lo contrario: el modelo no dictamina.** Gemini no tiene base de datos, y
preguntarle si una especie está vedada produce números de resolución inventados con total
seguridad. Lo normativo sale de listas oficiales guardadas en el servidor —Resolución 0126
de 2024, Catálogo de Plantas de Colombia, vedas nacionales y regionales— y Gemini solo
reconoce fotos y redacta. En pantalla cada bloque lleva su etiqueta: **Lista oficial** o
**Redactado por IA**.

Consecuencia práctica: BioScan **sigue sirviendo sin cuota**. Lo que está en las listas se
responde desde disco.

## Compilar los APK

Los compila GitHub Actions en cada push; no hay forma de compilarlos en local en el equipo
del proyecto (no hay JDK 17 ni SDK de Android).

| App | Artefacto | Etiqueta para publicar release |
| --- | --- | --- |
| XiloScan | `xiloscan-apk` | `v1`, `v2`… |
| BioScan | `bioscan-apk` | `bio-v1`, `bio-v2`… |

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app; git push
```

Las dos firman con la **misma clave** ([`android/keystore/`](android/keystore)). No hay
conflicto porque el `applicationId` es distinto: para Android son dos apps sin relación,
solo firmadas por el mismo autor. La clave estable es lo que permite instalar una versión
encima de la anterior sin desinstalar.

## Configuración del repositorio

En **Settings → Secrets and variables → Actions**:

| Tipo | Nombre | Para qué |
| --- | --- | --- |
| Variable | `BASE_URL` | URL pública del backend. Se compila dentro de los APK. |
| Secret | `APP_API_KEY` | Secreto compartido app ↔ backend. Debe coincidir con el del servidor. |
| Secret | `DEBUG_KEYSTORE_B64` | Opcional. Tiene prioridad sobre la clave versionada. |

Las claves de Gemini **no se configuran aquí**: solo existen en el entorno del servidor
desplegado y en el `.env` local, que está en `.gitignore`.

## Despliegue

El backend corre en **Render**, definido en [`render.yaml`](render.yaml). El plan gratuito
duerme el servicio tras 15 minutos sin tráfico, así que el propio servidor se llama a sí
mismo cada 10 minutos para no dormirse.

Queda preparado un [`backend/Dockerfile`](backend/Dockerfile) por si algún día se mueve a
Cloud Run.

**Pendiente:** `APP_API_KEY` no está configurado, así que el backend es público. El límite
por IP protege de ráfagas, pero quien descubra la URL puede consumir cuota de Gemini.
Ponerlo obliga a recompilar y reinstalar las dos apps.
