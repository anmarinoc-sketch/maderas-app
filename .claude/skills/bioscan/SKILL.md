---
name: bioscan
description: Contexto completo del proyecto BioScan (app Android + listas oficiales colombianas para saber si una especie es nativa, endémica, amenazada o vedada). Invócala al retomar el proyecto tras reiniciar el contexto, antes de tocar código, desplegar o diagnosticar fallos.
---

# BioScan

App Android que dice de una especie de flora o fauna si es nativa o exótica, endémica, en
qué categoría de amenaza está, si está vedada y cuál es su rango de distribución. Se le
pregunta por nombre o por foto.

Para Andrés, del comercio maderero del Valle de Aburrá (Medellín, Colombia). **Comparte
repositorio, servidor y clave de firma con [XiloScan](../xiloscan/SKILL.md)**: invoca esa
skill también si vas a tocar el backend o la CI.

## Estado y accesos

| Qué | Dónde |
| --- | --- |
| Repositorio | https://github.com/anmarinoc-sketch/maderas-app (el mismo que XiloScan) |
| App Android | `android-bioscan/`, paquete `com.bioscan.app` |
| Backend | `backend/` — el MISMO servicio de Render que XiloScan |
| APK | Artefacto `bioscan-apk` del workflow `apk-bioscan.yml` |
| Release | Etiqueta `bio-v*` (las de XiloScan son `v*`) |

Creado el 23-08-2026. Backend **desplegado y probado contra Gemini de verdad** ese mismo
día; APK publicado como release `bio-v1`. Lo que sigue **sin probar es la identificación
por foto con fotos reales**: solo se ha comprobado que el esquema funciona.

BioScan tiene su clave propia en Render (`GEMINI_API_KEY_ESPECIES`, proyecto de Google
`BioScan`). Se comprueba con `curl.exe -s https://madera-backend.onrender.com/health`:
`cuota_propia: true`. En local no hay clave: el `.env` tiene un marcador.

## La decisión que define el proyecto

El usuario pidió «que se conecte a Gemini para que busque en su base de datos». **Gemini
no tiene base de datos.** Preguntarle si una especie está vedada no consulta nada: redacta
lo más plausible e inventa números de resolución con total seguridad. Para alguien que
decide compras y aprovechamientos, eso es un daño real.

Así que el reparto es al revés de lo que pedía:

- **Las listas oficiales dictaminan.** Veda, amenaza, endemismo, origen, CITES y
  distribución salen de `backend/src/datos/`, con su norma citada.
- **Gemini solo mira y redacta.** Reconoce la especie de una foto y escribe la
  explicación. `lib/prompt-especies.js` le **prohíbe expresamente** pronunciarse sobre
  vedas, normas, categorías de amenaza, CITES, endemismo y distribución.

Tres consecuencias que hay que respetar en cualquier cambio:

1. **No encontrado no es no aplica.** El aviso de cobertura va SIEMPRE, haya veda o no.
   Callar sobre una veda que existe es peor que no responder.
2. **Cada dato lleva su procedencia.** En la app son tarjetas distintas, etiquetadas
   «Lista oficial» y «Redactado por IA». No mezclarlas nunca.
3. **Sin cuota la app sigue sirviendo.** Lo que está en las listas se responde desde disco
   en microsegundos. Solo el relato gasta, y si falla la ficha oficial se devuelve igual.

## Las listas y de dónde salen

`herramientas/construir-listas.js` las descarga y destila. Ejecutar cuando cambie una norma:

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app\backend; node herramientas/construir-listas.js
```

| Archivo | Fuente | Entradas |
| --- | --- | --- |
| `amenazadas-colombia.json` | **Resolución 0126 de 2024** (MADS), que derogó la 1912 de 2017 | 2.087 |
| `flora-colombia.json` | Catálogo de Plantas y Líquenes de Colombia (UNAL) | 44.477, de ellas 6.408 endémicas |
| `exoticas-colombia.json` | Lista de plantas exóticas del Humboldt | 1.292 |
| `nombres-comunes.json` | Derivado de amenazadas, aves endemicas y fauna | 3.216 |
| `vedas-colombia.json` | **Transcrito a mano.** No hay fuente legible por máquina | 14 normas, 77 especies |

Todo cabe: unos 120 MB de RSS y menos de medio segundo de arranque. Render da 512 MB.

**Lo que NO esta en disco se resuelve en caliente, y en este orden:** listas locales ->
GBIF (gratis, sin clave) -> modelo. GBIF cubre reptiles, anfibios, invertebrados y lo de
fuera con `fichaDeRespaldo`, que trae taxonomia, nombres comunes y cuantos registros hay
en Colombia. Va ANTES que el modelo a proposito: es gratis y el modelo cuesta cuota.
Tambien de GBIF sale la categoria mundial de la UICN, y de Wikipedia la foto.

**Ojo con la 1912 de 2017**: está derogada. Si alguien la menciona, es la 0126 de 2024.

## Huecos conocidos, que la app declara

- **Cornare esta completo.** El Acuerdo 404 de 2020 se transcribio con Gemini el
  23-08-2026 (el acta es un **PDF escaneado en JBIG2**, ilegible para todo lo demas:
  `pdftotext` no esta, poppler no esta, el extractor por zlib no sirve). Estan las 30
  filas del articulo primero -28 especies distintas, porque **el acuerdo repite dos**- y
  las 12 del segundo. Los Acuerdos 262 de 2011 y 207 de 2008 se retiraron del archivo:
  tenian cero especies y solo producian ruido.
  **Dos lecciones que costaron tres pasadas:**
  1. Una norma de veda trae VARIAS tablas con efectos juridicos distintos. La primera
     transcripcion las aplano en una lista de 49 y colaba como veda de Cornare siete
     especies de la Resolucion 0316 de 1974. **Nunca aceptar una transcripcion plana.**
  2. Ante nombres repetidos en un escaneo, la tentacion es darlos por error de lectura.
     Se releyo el PDF DOS veces y las dos coincidieron fila por fila, y cada fila
     repetida traia un nombre comun distinto: la norma repite de verdad. **Dos lecturas
     independientes antes de declarar un hueco.**
  El control de calidad que hizo fiable el resto: el articulo tercero recopila la
  resolucion de 1974, cuyas 7 especies ya teniamos por otra fuente, y coincidieron las 7.
- **Corantioquia sí está completa** (Resolución 3183 de 2000). Es la autoridad de la zona
  rural del Valle de Aburrá.
- **El AMVA no expide vedas de especies**: es autoridad urbana y regula el arbolado. Está
  comprobado, no es un hueco.
- **De fauna solo hay amenaza.** El Catálogo cubre únicamente flora.
- **CITES es de 2023 y envejece.** El cedro (*Cedrela odorata*) figura en el III cuando el
  género pasó al II. Por eso el dato va con la advertencia pegada.

## Trampas ya pisadas

Las de XiloScan siguen valiendo todas (firma del APK, Gson y los valores por defecto,
`keepAliveTimeout`, iconos de Material inexistentes, generar Kotlin por shell). Además:

- **Escribir `\uXXXX` por shell no funciona.** Bash y Node se comen los backslashes y el
  rango de diacríticos acabó como bytes literales dentro de un regex, que es justo la
  trampa que la skill de XiloScan avisa. La salida buena: `\p{Diacritic}`, que es ASCII.
  Comprobar con `LC_ALL=C grep -nP "[\x80-\xff]" archivo.js`.
- **Las claves del Darwin Core se construyen con `genus` + `specificEpithet`**, no
  partiendo `scientificName`: el nombre completo lleva autoría y rango intercalados y
  partirlo a ojo mezcla las variedades con su especie.
- **`paths` + `tags` en el mismo `push`** deja el release sin publicar. El workflow de
  BioScan va sin filtro de rutas, igual que el de XiloScan.
- **`api.github.com` da 504** desde este equipo a ratos. No es que la CI falle.

## Cuota de Gemini

**Claves separadas a propósito**: `GEMINI_API_KEY` (XiloScan) y `GEMINI_API_KEY_ESPECIES`
(BioScan), de **proyectos distintos de Google Cloud**. El nivel gratuito limita 20
peticiones diarias por modelo *y por proyecto*, así que con una sola clave un día de
identificar especies se comería las identificaciones de madera. Si la segunda falta, se
cae en la primera y comparten.

El motor (rotación de 8 modelos, cuotas, traducción de errores) está en
`lib/motor-gemini.js`, una instancia por clave. `lib/gemini.js` quedó como envoltura fina;
XiloScan no cambió de comportamiento.

## Qué queda pendiente

1. **Medir la identificación por foto con fotos de campo.** Con seis fotos de Wikipedia
   salieron 5 especies exactas y 1 género, sin fallos, pero esas fotos son faciles.
   Andrés tiene la app instalada desde `bio-v2`.
2. **Las 2 especies que faltan del Acuerdo 404** y los Acuerdos 262 de 2011 y 207 de 2008,
   que no estan publicados en la web de Cornare (probado: dan 404). Habria que pedirlos.
3. Nombres comunes: solo hay 878, de las especies amenazadas. GBIF cubre el resto en
   caliente, pero un índice local más grande ahorraría llamadas.

## Del diseño que trajo el usuario, lo que falta

Trajo una maqueta completa el 23-08-2026. Hecho: logo, bienvenida con boton Comenzar,
foto de la especie y el resumen de cuatro preguntas (nativa, endemica, amenazada, vedada).
Sin hacer, porque son funciones nuevas y no decisiones de estilo: navegacion inferior,
"Mis listas" y favoritos, "Mis observaciones", mapas de biodiversidad, perfil e inicio de
sesion. Guardar observaciones choca ademas con el disco efimero de Render.

## Trato con el usuario

No es desarrollador. Comandos completos listos para pegar, en PowerShell (`;` en vez de
`&&`, `curl.exe` en vez de `curl`), con los valores ya sustituidos. Prefiere que se hagan
las cosas por él.

Nunca escribir su `GEMINI_API_KEY` en ningún archivo: la pone él en el panel de Render.
