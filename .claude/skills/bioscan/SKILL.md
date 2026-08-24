---
name: bioscan
description: Contexto completo del proyecto BioScan (app Android + listas oficiales colombianas para saber si una especie es nativa, endémica, amenazada, en CITES o vedada). Invócala al retomar el proyecto tras reiniciar el contexto, antes de tocar código, desplegar o diagnosticar fallos.
---

# BioScan

App Android que responde, de una especie de flora o fauna colombiana: **¿nativa o exótica?
¿endémica? ¿amenazada? ¿en CITES? ¿vedada? ¿dónde vive?** Se consulta escribiendo un
nombre o haciendo una foto.

Para Andrés, del comercio maderero del Valle de Aburrá (Medellín). **Comparte repositorio,
servidor, clave de firma y CI con XiloScan**: invoca también la skill `xiloscan` si tocas
`backend/` o los workflows.

## Accesos

| Qué | Dónde |
| --- | --- |
| Repositorio | https://github.com/anmarinoc-sketch/maderas-app (público) |
| Carpeta local | `C:\Users\amo\Desktop\Claude\maderas-app` |
| App | `android-bioscan/`, paquete `com.bioscan.app` |
| Backend | `backend/` — el MISMO servicio de Render que XiloScan |
| Release | Etiqueta `bio-v*`. Última: **bio-v9** |
| Clave de Gemini | `GEMINI_API_KEY_ESPECIES` en Render, proyecto Google `BioScan` |

Creado el 23-08-2026 y desarrollado en una sola sesión larga. **Probado contra Gemini y
contra producción.** Lo único sin medir en serio es la identificación por foto con fotos
de campo.

## Cómo trabajar

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app; git push
```

**No se puede compilar Android en local** (no hay JDK 17 ni SDK) y **no hay acceso a los
logs de Actions ni de Render**: los fallos se diagnostican leyendo el código. Antes de
subir Kotlin, siempre:

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app\android-bioscan; node herramientas/comprobar.js
```

Comprueba llaves, paréntesis e imports olvidados, que son los dos fallos que más veces han
costado una vuelta entera de CI. No sustituye al compilador —no ve tipos ni nombres de
icono inexistentes— pero si no pasa, seguro que falla.

Comprobar el servidor sin credenciales:

```bash
curl.exe -s https://madera-backend.onrender.com/health
curl.exe -s https://madera-backend.onrender.com/api/listas
```

**Al publicar una versión**: subir `versionCode` y `versionName` en
`android-bioscan/app/build.gradle.kts` (la app enseña el número en Más), y etiquetar:

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app; git tag bio-v10; git push origin bio-v10
```

### Los cuatro workflows

| Workflow | Cuándo | Qué hace |
| --- | --- | --- |
| Compilar APK de BioScan | cada push y tags `bio-v*` | APK y release |
| Compilar APK de XiloScan | cada push y tags `v*` | lo mismo para XiloScan |
| Actualizar las listas oficiales | día 1 de cada mes | regenera los datos y los sube |
| Respaldar verificaciones | a diario | salva las correcciones de XiloScan |

## Las seis reglas que no se rompen

1. **El modelo no dictamina.** Gemini no tiene base de datos: preguntarle si algo está
   vedado produce números de resolución inventados. Veda, amenaza, endemismo, origen,
   CITES y distribución salen de `src/datos/`. `lib/prompt-especies.js` se lo prohíbe.
   **Única excepción**, acotada en el prompt: si el origen no consta en ninguna lista,
   puede decir si es nativa o exótica, y la app lo marca como no verificado.
2. **No encontrado ≠ no aplica.** `veda.aplica` tiene tres valores: `true` (flora),
   `false` (fauna, no le aplica el régimen) y `null` (no se pudo determinar el grupo).
3. **Cada dato lleva su procedencia.** En pantalla, tarjetas etiquetadas «Lista oficial» y
   «Redactado por IA», con estilos distintos. No mezclarlas nunca.
4. **Sin cuota, la app sigue sirviendo.** Lo que está en disco se responde en microsegundos.
   Solo el relato gasta, y si falla, la ficha oficial se devuelve igual.
5. **Lo que no viene al caso no se pinta.** Una respuesta que describe la lista consultada
   en vez de la especie es un hueco con aspecto de dato, y en esta app eso vale menos que
   el silencio. Tres consecuencias, de bio-v7 y bio-v8:
   - **Especie exótica** (`es_exotica`, flora y fauna por igual): solo se dice que es
     exótica. Sin endemismo, sin categoría de amenaza, sin UICN mundial. **Sí se quedan
     CITES** —aplica aunque la especie sea introducida; el hipopótamo del Magdalena está
     en el Apéndice II— y el potencial invasor. **Y en flora, LA VEDA**, que es la trampa
     de este ajuste: las vedas alcanzan POR FAMILIA, así que la piña sale exótica y vedada
     a la vez por Bromeliaceae. Esconderla por ser exótica sería el error que la app existe
     para evitar; en flora exótica el apartado se llama solo «Veda», sin la fila de
     amenaza. La bandera se decide en DOS sitios porque los casos llegan por dos caminos:
     `especies.js` para lo que está en las listas, y `routes/especies.js` para lo que no
     está en ninguna y solo se sabe que es introducido cuando vuelve el relato (el
     hipopótamo, la tilapia, el caballo). Las dos rutas exigen que no haya categoría
     nacional ni del Catálogo: si alguna de las dos habla, manda ella. `fauna_exotica`
     sigue viajando en la respuesta porque bio-v7 solo sabe leer esa.
   - **La fila de veda nacional solo sale si hay veda nacional.** Las nacionales de flora
     alcanzan a pocas especies y casi siempre a las mismas, así que repetía «sin veda». En
     su sitio va la condición de amenaza de la Resolución 0126, que sí cambia de una
     especie a otra. Si la veda nacional alcanza a la especie, la fila vuelve.
   - **`habitos_alimenticios`** solo se rellena en fauna; en flora viene vacío y el párrafo
     no se pinta.
6. **De una norma no importa su antigüedad, sino la de la comprobación.** Una veda de 1977
   manda igual que una de 2020 si nadie la derogó. Por eso `src/datos/vigencia-normas.json`
   (curado a mano, **aparte de las listas porque el workflow mensual las regenera**) guarda
   norma por norma el estado, la fecha en que se miró y qué se encontró. La ficha lo enseña,
   y **el aviso de caducidad lo calcula el servidor con la fecha de hoy**, no el teléfono:
   un aparato ya instalado empieza a avisar solo el día que se cumple el plazo, sin
   reinstalar nada. Plazo: 12 meses. Comprobado el 24-08-2026, las 13 normas vigentes.

## Mapa del código

### Backend (`backend/src/`)

| Archivo | Qué hace |
| --- | --- |
| `app.js` | Monta Express, `/health` con el estado de las dos apps |
| `config.js` | Variables de entorno. **Dos claves de Gemini**, una por app |
| `lib/especies.js` | **El corazón.** Cruza un nombre contra las listas y arma la ficha |
| `lib/gbif.js` | GBIF: normalizar nombres, nombres vulgares, UICN, y `fichaDeRespaldo` |
| `lib/foto.js` | Foto de Wikipedia por nombre científico, con caché |
| `lib/prompt-especies.js` | Prompts y esquemas: foto, resolución de nombre y relato |
| `lib/gemini-especies.js` | Motor de Gemini con la clave de BioScan |
| `lib/motor-gemini.js` | Rotación de 8 modelos, cuotas y errores. **Compartido con XiloScan**, una instancia por clave |
| `lib/transcribir.js` | Transcribe una norma escaneada con Gemini |
| `routes/especies.js` | `GET /api/especie`, `POST /api/identificar-especie`, `GET /api/listas` |
| `herramientas/construir-listas.js` | Descarga y destila **todas** las listas |
| `herramientas/comparar-listas.js` | Cuenta y compara; lo usa el workflow mensual |
| `herramientas/transcribir-acuerdo.js` | Línea de comandos para una norma escaneada |
| `herramientas/zip.js` | Lector mínimo de ZIP y TSV para los Darwin Core |
| `herramientas/auditar-cobertura.js` | Qué cubren las listas, grupo por grupo. Pasarlo tras cada actualización |
| `herramientas/medir-fotos.js` | Mide el acierto de la identificación por foto |
| `herramientas/revisar-vigencia.js` | Si toca volver a comprobar las normas. Sale en rojo si el plazo venció; corre al final del workflow mensual con `always()` |

Lo de XiloScan (`lib/gemini.js`, `prompt.js`, `referencia.js`, `aprendizaje.js`,
`huella.js`, `routes/identificar.js`) **no se toca desde aquí**.

### App (`android-bioscan/app/src/main/java/com/bioscan/app/`)

| Archivo | Qué hace |
| --- | --- |
| `MainActivity.kt` | Bienvenida y luego pantalla principal |
| `BioScanApp.kt` | **Solo existe para el User-Agent de Coil.** Sin él, Wikimedia da 403 |
| `ui/PantallaBienvenida.kt` | Logo, nombre y botón Comenzar |
| `ui/PantallaPrincipal.kt` | Cabecera, buscador, tarjetas de acción, barra inferior y todos los estados |
| `ui/Piezas.kt` | Piezas repetidas: icono redondo, tarjeta de acción, fila con flecha |
| `ui/Ficha.kt` | **La ficha entera.** Foto, resumen, veda, amenaza, origen, distribución, relato |
| `ui/PantallaGuardados.kt` | Historial, Favoritos y la sección Más |
| `ui/PantallaAjusteFoto.kt` | Recortar y girar antes de subir. Portada de XiloScan |
| `ui/PantallaAjustes.kt` | URL, clave y el interruptor del relato |
| `ui/BioViewModel.kt` | Estados, llamadas, historial y favoritos |
| `data/Modelos.kt` | Espejo del JSON. **Todo nullable**: Gson no aplica los valores por defecto |
| `data/BioApi.kt`, `data/Repositorio.kt` | Retrofit y traducción de fallos de red |
| `util/Guardados.kt` | Historial y favoritos, en SharedPreferences del teléfono |
| `util/Imagenes.kt` | Prepara la foto antes de subirla (lado máx. 1280) |

## Cómo resuelve una consulta

**Por nombre** (`GET /api/especie?q=…&relato=1`), parando en el primero que responda. Los
dos primeros no gastan cuota:

1. Nombre científico que está en las listas → ficha directa.
2. **Binomio que no está en ninguna lista** → `fichaDeRespaldo` de GBIF, ANTES que el
   modelo, porque es gratis. Cubre reptiles, anfibios, insectos y especies de fuera.
3. Nombre común → se unen el índice local y GBIF, **se filtra por Colombia** y se enseñan
   TODAS las opciones. Un nombre común casi nunca designa una sola cosa: «roble» son siete.
4. Nada lo reconoce → lo propone el modelo y lo verifican las listas.

**Por foto**: se recorta y gira primero, luego Gemini identifica, y el backend adjunta la
ficha oficial de la principal **y de cada alternativa**.

## Las listas y de dónde salen

Unos **50.500 registros**, 115 MB de RSS, 170 ms de arranque. Render da 512 MB.

| Archivo | Fuente | Entradas |
| --- | --- | --- |
| `flora-colombia.json` | Catálogo de Plantas y Líquenes de Colombia (UNAL) | 44.477, 6.408 endémicas |
| `fauna-colombia.json` | Aves (ACO), mamíferos y peces de agua dulce, SiB | 4.246 |
| `herpetofauna-colombia.json` | **GBIF**: especies con registros en Colombia | 1.807 |
| `amenazadas-colombia.json` | **Resolución 0126 de 2024** (derogó la 1912 de 2017) | 2.087 |
| `exoticas-colombia.json` | Plantas exóticas (Humboldt) | 1.292 |
| `aves-endemicas-colombia.json` | Aves endémicas y casi-endémicas (Humboldt) | 268 |
| `nombres-comunes.json` | Derivado de las anteriores | 3.216 |
| `vedas-colombia.json` | **Curado a mano.** No hay fuente legible por máquina | 12 normas |
| `cites-actualizaciones.json` | **Curado a mano.** Apéndices posteriores al Catálogo | 5 géneros |

Las siete primeras las regenera solo el workflow mensual, con un freno: si una lista
encoge más de un 20 %, falla y no sube nada. A mano:
`node herramientas/construir-listas.js`.

**Ojo con la 1912 de 2017: está derogada.** Si alguien la menciona, es la 0126 de 2024.

Orden de las fuentes: **listas locales → GBIF → Wikipedia (solo la foto) → el modelo.**

## Lo que se probó y NO sirve

- **GBIF para decir si algo es nativo.** Sus `distributions` dicen que *Amazona
  ochrocephala* es `INTRODUCED` (viene de un registro mundial de invasoras, referido a otro
  país) y de *Danaus plexippus* devuelven localidades de las Azores. Para origen mandan las
  listas colombianas.
- **API pública de CITES.** Species+ pide token (401) y checklist.cites.org no responde
  (404). Por eso `cites-actualizaciones.json` se mantiene a mano.
- **Leer el PDF del Acuerdo 404 sin Gemini.** Es JBIG2: no hay `pdftotext`, no hay poppler,
  y el extractor por zlib no sirve.

## Huecos conocidos, que la app declara

- **Reptiles y anfibios**: hay taxonomía y nombres comunes, pero no origen ni endemismo
  oficial, porque no existe lista nacional publicada. Ahí responde el modelo, marcado.
- **Insectos, invertebrados y peces marinos**: sin lista local. Los resuelve GBIF.
- **Vedas**: nacionales, Corantioquia y Cornare. Otras corporaciones no están.
- **El AMVA no expide vedas de especies**: es autoridad urbana y regula el arbolado. Está
  comprobado, no es un hueco.
- **CITES**: cargados *Cedrela* (II desde 2020) y *Handroanthus*, *Tabebuia*,
  *Roseodendron* y *Dipteryx* (II desde el 25-11-2024). **Tras cada CoP hay que revisarlo.**
  Revisada la **CoP20** (Samarcanda, 24-11 a 5-12 de 2025; en vigor desde el 5-03-2026):
  ninguno de sus cambios de flora toca a las maderas colombianas —palma chilena al I, dos
  *Beaucarnea* y cuatro *Aloe* al II, enmienda a la anotación #10 del palo de Pernambuco, y
  el padouk africano (*Pterocarpus*) **rechazado**—. Los cambios entran en vigor 90 días
  después de la reunión.

## Trampas ya pisadas

Las de XiloScan siguen valiendo todas. Además:

- **Wikimedia devuelve 403 a los User-Agent de librería.** Con `okhttp/4.12.0`: 403, 126
  bytes. Con uno que identifique la app: 200, 267 KB. Y no da error visible: la imagen sale
  en gris. Por eso existe `BioScanApp.kt`.
- **Escribir código por shell se come comillas y barras invertidas.** Un rango de
  diacríticos acabó como bytes literales dentro de un regex, y una lista de cadenas perdió
  todas sus comillas. **Escribir Kotlin y JS con Write/Edit, nunca con `sed` ni `node -e`.**
  Comprobar con `LC_ALL=C grep -nP "[\x80-\xff]"` y usar `\p{Diacritic}`, que es ASCII.
- **Un backtick dentro de una plantilla de JS la cierra.** Nombrar un campo con backticks
  dentro de un prompt rompió el módulo entero.
- **Amenazada NO es vedada.** La Resolución 0126 de 2024 dice expresamente que no modifica
  las vedas. Pero decir solo «sin veda» de una especie en peligro engaña, así que la ficha
  lleva `nota_amenazada` justo donde se lee «sin veda».
- **La Resolución 0126 categoriza a veces la especie y a veces cada subespecie**, con
  categorías distintas. Hay que quedarse con la PEOR: la danta figura como VU y su
  subespecie colombiana está en CR. **Subestimar el riesgo es el peor error de esta app.**
- **Las claves Darwin Core se construyen con `genus` + `specificEpithet`**, nunca partiendo
  `scientificName`: lleva autoría y rango intercalados y mezcla variedades con su especie.
- **GBIF ya no agrupa los reptiles bajo `Reptilia`**: Squamata, Testudines y Crocodylia van
  como clases separadas, y preguntar por Reptilia devuelve cero **sin dar ningún error**.
- **El índice de nombres vulgares de GBIF es mundial y muy ruidoso.** Con «roble» saca
  antes hayas de Chile. Filtrar por Colombia, y **filtrar ANTES de recortar**.
- **Comparar nombres comunes por substring** hacía que «lora» encontrara «passi**flora**».
  Comparar por palabras.
- **`fillMaxHeight` dentro de una Row que se ajusta al contenido** pide altura infinita.
  Hace falta `Modifier.height(IntrinsicSize.Min)` en la Row.
- **`ContentScale.Crop` en la foto de la ficha** le cortaba la cabeza a las aves. `Fit`.
- **`paths` + `tags` en el mismo `push`** deja el release sin publicar.
- **`api.github.com` da 504** desde este equipo a ratos. No es que la CI falle.

### Transcribir normas escaneadas

El Acuerdo 404 de Cornare costó tres pasadas:

1. **Nunca aceptar una transcripción plana.** Una norma trae varias tablas con efectos
   jurídicos distintos; la primera pasada las aplanó en una lista de 49 y colaba como veda
   de Cornare siete especies de una norma nacional de 1974.
2. **Dos lecturas independientes antes de declarar un hueco.** Los nombres repetidos
   parecían error de lectura; releído dos veces coincidieron fila por fila, y cada fila
   traía un nombre común distinto: el acuerdo repite de verdad. Son 30 filas y 28 especies.
3. **Buscar siempre un grupo de control.** El artículo tercero recopilaba una resolución
   que ya teníamos por otra fuente, y coincidieron las 7 especies.

## Qué queda pendiente

1. **Medir la identificación por foto CON FOTOS DE CAMPO.** Ya existe el banco automático
   (`node herramientas/medir-fotos.js`), pero usa fotos de Wikipedia, que son fáciles:
   bien encuadradas y tomadas por alguien que sabía qué fotografiaba. Salieron 5 especies
   exactas y 1 género de 6, sin fallos, y eso es el techo, no lo que se ve en campo.
   Para medir de verdad hay que cambiar el banco por fotos del usuario.
2. **`APP_API_KEY` sin configurar**: el backend es público. El límite por IP protege de
   ráfagas, pero quien descubra la URL puede gastar cuota. Ponerlo obliga a recompilar y
   reinstalar las dos apps.
3. Del diseño quedan **«Mis observaciones»** (guardar tus propias fotos con su ubicación) y
   los **mapas de biodiversidad**. Historial y Favoritos ya están, en el teléfono. No hará
   falta inicio de sesión mientras nada se guarde en el servidor: su disco es efímero.
4. Los Acuerdos **262 de 2011 y 207 de 2008** de Cornare, que no están publicados en su web.

## Trato con el usuario

No es desarrollador. Comandos completos listos para pegar, en PowerShell (`;` en vez de
`&&`, `curl.exe` en vez de `curl`), con los valores ya sustituidos. Prefiere que se hagan
las cosas por él, y agradece que se le publique el release en vez de mandarlo a Actions.

**Prueba la app en campo y su feedback suele acertar aunque la razón que dé sea otra.**
Avisó de que «el cedro está vedado según la Resolución 0126»: la resolución no es de vedas
—ahí no llevaba razón— pero al mirarlo apareció que los apéndices CITES estaban cuatro años
atrasados y faltaban 58 especies maderables.

**Cuando pida quitar un aviso, mirar primero si el aviso está mal o si el dato está mal.**
En los cuatro casos de esta sesión el problema de fondo era un error, no el aviso: el aviso
de veda en fauna, el letrero naranja, las fotos en gris y el «sin veda» del cedro.

Nunca escribir su `GEMINI_API_KEY` en ningún archivo: la pone él en el panel de Render.
