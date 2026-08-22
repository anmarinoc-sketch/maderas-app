# Identifica Madera — app Android

App Android que fotografía el corte transversal de una pieza de madera, la envía al
backend [`madera-backend`](../madera-backend) y muestra la especie identificada junto con la
anatomía observada.

La clave de Gemini **no está en la app**: vive solo en el servidor. La app únicamente conoce
la URL del backend.

```
Cámara / Galería ──▶ comprimir a JPEG ──▶ POST /api/identificar-madera ──▶ resultado en pantalla
```

## Cómo obtener el APK sin instalar nada

No hace falta Android Studio ni el SDK: lo compila GitHub Actions.

1. Sube este proyecto a un repositorio de GitHub.
2. En **Settings → Secrets and variables → Actions → Variables**, crea la variable
   `BASE_URL` con la URL pública de tu backend (por ejemplo `https://madera.onrender.com`).
   Si tu backend exige `X-App-Key`, añade además el *secret* `APP_API_KEY`.
3. Ve a la pestaña **Actions → Compilar APK → Run workflow**. También puedes indicar la URL
   ahí mismo, en el campo del formulario, sin tocar la configuración del repositorio.
4. Cuando termine (unos 3-5 minutos la primera vez), descarga el artefacto
   `identifica-madera-apk` desde la página de la ejecución.

Para instalarlo directamente desde el móvil, crea una etiqueta:

```bash
git tag v0.1.0; git push origin v0.1.0
```

El workflow publica un *release* con el APK adjunto: abre la URL del release en el navegador
del teléfono y descárgalo. Android pedirá permiso para instalar de orígenes desconocidos.

## La URL del backend

Se resuelve en tres niveles, de menor a mayor prioridad:

| Nivel | Dónde | Para qué |
| --- | --- | --- |
| Por defecto | `http://10.0.2.2:3000/` | El `localhost` del PC visto desde el emulador |
| Al compilar | `BASE_URL` (variable de entorno o `-PbaseUrl=`) | Lo que inyecta GitHub Actions |
| En caliente | Ajustes de la app (icono del engranaje) | Cambiar de servidor sin recompilar |

Esa pantalla de ajustes tiene un botón **Probar conexión** que llama a `/health` y dice si el
servidor responde. Es la forma rápida de distinguir "el backend está caído" de "la URL está mal".

Ten en cuenta que un móvil real no puede llegar a `localhost` de tu PC. Opciones: la IP local
del PC en la misma wifi (`http://192.168.1.X:3000`), un túnel (`ngrok http 3000`), o el
backend ya desplegado.

## Permisos

La app **no pide ningún permiso en tiempo de ejecución**, solo `INTERNET`:

- La foto se toma con la app de cámara del sistema (`ACTION_IMAGE_CAPTURE`), que no requiere
  el permiso `CAMERA` mientras no lo declaremos en el manifiesto.
- La galería usa el Photo Picker de Android, que no requiere permisos de almacenamiento.

Las fotos se procesan en memoria y la captura temporal se borra en la siguiente toma.

## Compilar en local (opcional)

Necesitas JDK 17 y el SDK de Android. Al abrir el proyecto, Android Studio genera el Gradle
wrapper (este repositorio no incluye `gradle-wrapper.jar`, que es un binario). Después:

```bash
./gradlew assembleDebug -PbaseUrl=http://10.0.2.2:3000/
```

El APK queda en `app/build/outputs/apk/debug/`.

## Estructura

```
app/src/main/java/com/madera/identificador/
  MainActivity.kt              punto de entrada, monta Compose
  ui/PantallaIdentificar.kt    pantalla única: captura, estados y resultado
  ui/IdentificarViewModel.kt   estado de la UI y orquestación
  ui/theme/Tema.kt             paleta Material 3 (claro y oscuro)
  data/Modelos.kt              espejo del JSON del backend
  data/MaderaApi.kt            Retrofit + OkHttp, URL base dinámica
  data/Repositorio.kt          llamada y traducción de errores de red
  util/Imagenes.kt             EXIF, escalado a 1600 px y compresión JPEG
  util/Ajustes.kt              preferencias locales (URL y clave)
```

### Decisiones que conviene conocer

- **Gson con campos nullable.** Gson instancia las clases sin pasar por el constructor de
  Kotlin, así que los valores por defecto no se aplican y un campo ausente dejaría un `null`
  en una propiedad declarada no-nula. Por eso los modelos son nullable y la UI resuelve con
  `?:` y `orEmpty()`.
- **Escalado en dos pasos.** Se decodifica con `inSampleSize` y luego se escala fino. Cargar
  una foto de 12 MP de golpe provoca `OutOfMemory` en gama baja.
- **Orientación EXIF.** Muchas cámaras guardan la foto girada y anotan la rotación en los
  metadatos; sin corregirla, el modelo analizaría la imagen de lado.
- **`applicationIdSuffix = ".debug"`.** Permite tener instaladas a la vez la versión de
  pruebas y una futura de producción.

## Estado

El proyecto está completo pero **nunca se ha compilado**: en el equipo donde se escribió no
hay JDK 17 ni SDK de Android. La primera ejecución del workflow es la primera compilación
real, y es normal que aparezca algún ajuste de versiones o algún import que sobra.
