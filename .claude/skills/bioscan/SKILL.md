---
name: bioscan
description: Contexto completo del proyecto BioScan (app Android + listas oficiales colombianas para saber si una especie es nativa, endémica, amenazada o vedada). Invócala al retomar el proyecto tras reiniciar el contexto, antes de tocar código, desplegar o diagnosticar fallos.
---

# BioScan

App Android que responde, de una especie de flora o fauna colombiana: **¿nativa o exótica?
¿endémica? ¿amenazada? ¿vedada?** Se consulta escribiendo un nombre o haciendo una foto.

Para Andrés, del comercio maderero del Valle de Aburrá (Medellín). **Comparte repositorio,
servidor, clave de firma y CI con XiloScan**: invoca también la skill `xiloscan` si vas a
tocar `backend/` o los workflows.

## Estado y accesos

| Qué | Dónde |
| --- | --- |
| Repositorio | https://github.com/anmarinoc-sketch/maderas-app (público) |
| Carpeta local | `C:\Users\amo\Desktop\Claude\maderas-app` |
| App | `android-bioscan/`, paquete `com.bioscan.app` |
| Backend | `backend/` — el MISMO servicio de Render que XiloScan |
| Release | Etiqueta `bio-v*`. Última: **bio-v3** (23-08-2026) |
| Clave de Gemini | `GEMINI_API_KEY_ESPECIES` en Render, proyecto Google `BioScan` |

Creado el 23-08-2026 y probado contra Gemini y contra producción ese mismo día. Lo único
sin probar en serio es **la identificación por foto con fotos de campo**.

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app; git push
```

Comprobar sin credenciales:

```bash
curl.exe -s https://madera-backend.onrender.com/health
curl.exe -s https://madera-backend.onrender.com/api/listas
```

**No hay acceso a los logs de Actions ni de Render**, y no se puede compilar Android en
local (no hay JDK 17 ni SDK). Los fallos se diagnostican leyendo el código. Antes de subir
Kotlin, al menos comprobar que las llaves y los paréntesis cuadran.

## Las cuatro reglas que no se rompen

1. **El modelo no dictamina.** Gemini no tiene base de datos: preguntarle si algo está
   vedado produce números de resolución inventados. Veda, amenaza, endemismo, origen,
   CITES y distribución salen de `src/datos/`. `lib/prompt-especies.js` se lo prohíbe
   expresamente. **La única excepción**, acotada en el prompt: si el origen no consta en
   ninguna lista, puede decir si es nativa o exótica, y la app lo marca como no verificado.
2. **No encontrado ≠ no aplica.** `veda.aplica` tiene tres valores: `true` (flora),
   `false` (fauna, no le aplica el régimen) y `null` (no se pudo determinar el grupo).
3. **Cada dato lleva su procedencia.** En pantalla, tarjetas distintas etiquetadas
   «Lista oficial» y «Redactado por IA». No mezclarlas nunca.
4. **Sin cuota, la app sigue sirviendo.** Lo que está en disco se responde en microsegundos.
   Solo el relato gasta, y si falla, la ficha oficial se devuelve igual.

## Mapa del código

### Backend (`backend/src/`)

| Archivo | Qué hace |
| --- | --- |
| `app.js` | Monta Express, `/health` con el estado de las dos apps |
| `config.js` | Variables de entorno. **Dos claves de Gemini**, una por app |
| `lib/especies.js` | **El corazón.** Cruza un nombre contra las listas y arma la ficha |
| `lib/gbif.js` | GBIF: normalizar nombres, buscar por nombre vulgar, UICN, y `fichaDeRespaldo` para lo que no está en las listas |
| `lib/foto.js` | Foto de Wikipedia por nombre científico, con caché |
| `lib/prompt-especies.js` | Prompts y esquemas: foto, resolución de nombre y relato |
| `lib/gemini-especies.js` | Motor de Gemini con la clave de BioScan |
| `lib/motor-gemini.js` | Rotación de 8 modelos, cuotas y errores. **Compartido con XiloScan**, una instancia por clave |
| `lib/transcribir.js` | Transcribe una norma escaneada con Gemini |
| `routes/especies.js` | `GET /api/especie`, `POST /api/identificar-especie`, `GET /api/listas` |
| `herramientas/construir-listas.js` | Descarga y destila **todas** las listas. Se ejecuta a mano |
| `herramientas/zip.js` | Lector mínimo de ZIP y TSV para los Darwin Core |

Lo de XiloScan (`lib/gemini.js`, `prompt.js`, `referencia.js`, `aprendizaje.js`,
`huella.js`, `routes/identificar.js`) **no se toca desde aquí**.

### App (`android-bioscan/app/src/main/java/com/bioscan/app/`)

| Archivo | Qué hace |
| --- | --- |
| `MainActivity.kt` | Bienvenida y luego pantalla principal |
| `BioScanApp.kt` | **Solo existe para el User-Agent de Coil.** Sin él, Wikimedia devuelve 403 y las fotos salen en gris |
| `ui/PantallaBienvenida.kt` | Logo, nombre y botón Comenzar |
| `ui/PantallaPrincipal.kt` | Buscador, botones de foto, y el estado (candidatas, ficha, resultado de foto) |
| `ui/Ficha.kt` | **La ficha entera.** Foto, resumen de preguntas, veda, amenaza, origen, distribución, relato |
| `ui/PantallaAjustes.kt` | URL, clave, y el interruptor del relato |
| `ui/BioViewModel.kt` | Estados y llamadas |
| `data/Modelos.kt` | Espejo del JSON. **Todo nullable**: Gson no aplica los valores por defecto de Kotlin |
| `data/BioApi.kt`, `data/Repositorio.kt` | Retrofit y traducción de fallos de red |
| `util/Imagenes.kt` | Prepara la foto antes de subirla (lado máx. 1280) |

## Cómo resuelve una consulta

**Por nombre** (`GET /api/especie?q=…&relato=1`), en tres pasos, parando en el primero que
responda. Los dos primeros no gastan cuota:

1. Nombre científico que está en las listas → ficha directa.
2. Nombre común → se unen el índice local y GBIF, **se filtra por Colombia** y se enseñan
   TODAS las opciones. Un nombre común casi nunca designa una sola cosa: "roble" son siete.
3. Nada lo reconoce → lo propone el modelo y lo verifican las listas.

Si parece un binomio pero no está en ninguna lista, entra `fichaDeRespaldo` de GBIF
**antes** que el modelo, porque es gratis.

**Por foto** (`POST /api/identificar-especie`): Gemini identifica, y el backend adjunta la
ficha oficial de la principal **y de cada alternativa**.

## Las listas y de dónde salen

`node herramientas/construir-listas.js` las regenera todas. **Unos 50.500 registros**, 115
MB de RSS, 170 ms de arranque.

| Archivo | Fuente | Entradas |
| --- | --- | --- |
| `flora-colombia.json` | Catálogo de Plantas y Líquenes de Colombia (UNAL) | 44.477, 6.408 endémicas |
| `fauna-colombia.json` | Aves (ACO), mamíferos y peces de agua dulce, SiB | 4.246 |
| `herpetofauna-colombia.json` | **GBIF**: especies con registros en Colombia | 1.807 |
| `amenazadas-colombia.json` | **Resolución 0126 de 2024** (derogó la 1912 de 2017) | 2.087 |
| `exoticas-colombia.json` | Plantas exóticas (Humboldt) | 1.292 |
| `aves-endemicas-colombia.json` | Aves endémicas y casi-endémicas (Humboldt) | 268 |
| `nombres-comunes.json` | Derivado de las anteriores | 3.216 |
| `vedas-colombia.json` | **Transcrito a mano.** No hay fuente legible por máquina | 12 normas |

**Ojo con la 1912 de 2017: está derogada.** Si alguien la menciona, es la 0126 de 2024.

Orden de las fuentes: **listas locales → GBIF → Wikipedia (solo la foto) → el modelo**.

**GBIF NO sirve para decir si algo es nativo.** Sus `distributions` dicen que
*Amazona ochrocephala* es `INTRODUCED` (viene de un registro mundial de invasoras, referido
a otro país) y de *Danaus plexippus* devuelven localidades de las Azores. Probado y
descartado: para origen mandan las listas colombianas.

## Huecos conocidos, que la app declara

- **Reptiles y anfibios**: hay taxonomía y nombres comunes, pero no origen ni endemismo
  oficial, porque no existe lista nacional publicada. Ahí responde el modelo, marcado.
- **Insectos, invertebrados y peces marinos**: sin lista local. Los resuelve GBIF.
- **Vedas**: nacionales, Corantioquia y Cornare. Las demás corporaciones no están.
- **El AMVA no expide vedas de especies**: es autoridad urbana y regula el arbolado. Está
  comprobado, no es un hueco.
- **CITES es de 2023 y envejece**: el cedro figura en el III cuando el género pasó al II.

## Trampas ya pisadas

Las de XiloScan siguen valiendo todas. Además:

- **Wikimedia devuelve 403 a los User-Agent de librería.** Con `okhttp/4.12.0`: 403, 126
  bytes. Con uno que identifique la app: 200, 267 KB. Y no da error visible: la imagen sale
  en gris. Por eso existe `BioScanApp.kt`.
- **Escribir `\uXXXX` o comillas por shell no funciona**: bash y Node se comen los
  backslashes, y un rango de diacríticos acabó como bytes literales dentro de un regex.
  Usar `\p{Diacritic}`, que es ASCII, y comprobar con `LC_ALL=C grep -nP "[\x80-\xff]"`.
  Escribir Kotlin y JS con Write/Edit, nunca con `sed` ni `node -e`.
- **Un backtick dentro de una plantilla de JS la cierra.** Nombrar un campo con backticks
  dentro de un prompt rompió el módulo entero.
- **Las claves Darwin Core se construyen con `genus` + `specificEpithet`**, nunca partiendo
  `scientificName`: lleva autoría y rango intercalados y mezcla variedades con su especie.
- **La Resolución 0126 categoriza unas veces la especie y otras cada subespecie**, con
  categorías distintas. Hay que quedarse con la PEOR del grupo: la danta figura como VU y
  su subespecie colombiana está en CR. Subestimar el riesgo es el peor error de esta app.
- **GBIF ya no agrupa los reptiles bajo `Reptilia`**: Squamata, Testudines y Crocodylia van
  como clases separadas, y preguntar por Reptilia devuelve cero **sin dar ningún error**.
- **El índice de nombres vulgares de GBIF es mundial y muy ruidoso.** Con "roble" saca
  antes hayas de Chile. Filtrar por Colombia, y **filtrar ANTES de recortar**, o las
  colombianas se pierden porque vienen al final.
- **Comparar nombres comunes por substring** hacía que "lora" encontrara "passi**flora**".
  Comparar por palabras.
- **`paths` + `tags` en el mismo `push`** deja el release sin publicar.
- **`api.github.com` da 504** desde este equipo a ratos. No es que la CI falle.

### Dos lecciones sobre transcribir normas escaneadas

El Acuerdo 404 de Cornare solo existe como PDF escaneado en JBIG2, ilegible para todo salvo
Gemini. Costó tres pasadas:

1. **Nunca aceptar una transcripción plana.** Una norma trae varias tablas con efectos
   jurídicos distintos; la primera pasada las aplanó en una lista de 49 y colaba como veda
   de Cornare siete especies de una norma nacional de 1974.
2. **Dos lecturas independientes antes de declarar un hueco.** Los nombres repetidos
   parecían error de lectura; releído dos veces coincidieron fila por fila, y cada fila
   traía un nombre común distinto: el acuerdo repite de verdad. Son 30 filas y 28 especies.

Y **buscar siempre un grupo de control**: el artículo tercero recopilaba una resolución que
ya teníamos por otra fuente, y coincidieron las 7 especies. Sobre eso se aceptó el resto.

## Qué queda pendiente

1. **Medir la identificación por foto con fotos de campo.** Con seis de Wikipedia salieron
   5 especies exactas y 1 género, sin fallos, pero esas fotos son fáciles.
2. **`APP_API_KEY` sin configurar**: el backend es público. El límite por IP protege de
   ráfagas, pero quien descubra la URL puede gastar cuota. Ponerlo obliga a recompilar y
   reinstalar las dos apps.
3. **La app no muestra su número de versión**, así que no hay forma de saber cuál está
   instalada sin mirar el APK.
4. Del diseño que trajo el usuario quedan sin hacer, y son funciones nuevas, no estilo:
   navegación inferior, «Mis listas» y favoritos, «Mis observaciones», mapas de
   biodiversidad, perfil e inicio de sesión. Guardar observaciones choca con el disco
   efímero de Render.

## Trato con el usuario

No es desarrollador. Comandos completos listos para pegar, en PowerShell (`;` en vez de
`&&`, `curl.exe` en vez de `curl`), con los valores ya sustituidos. Prefiere que se hagan
las cosas por él.

Da feedback muy concreto usando la app en campo, y **suele tener razón**: el aviso de veda
en fauna, el letrero naranja y las fotos en gris salieron todos de que él las viera. Cuando
pida quitar un aviso, mirar primero si el aviso está mal o si el dato está mal — en los
tres casos el problema de fondo era un error, no el aviso.

Nunca escribir su `GEMINI_API_KEY` en ningún archivo: la pone él en el panel de Render.
