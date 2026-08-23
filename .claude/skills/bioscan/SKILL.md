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
| `nombres-comunes.json` | Derivado de la lista de amenazadas | 878 |
| `vedas-colombia.json` | **Transcrito a mano.** No hay fuente legible por máquina | 14 normas, 77 especies |

Todo cabe: 107 MB de RSS, 221 ms de arranque, 9 µs por consulta. Render da 512 MB.

**Ojo con la 1912 de 2017**: está derogada. Si alguien la menciona, es la 0126 de 2024.

## Huecos conocidos, que la app declara

- **Cornare: faltan 2 de 30.** El Acuerdo 404 de 2020 se transcribio el 23-08-2026 con
  Gemini (el acta es un **PDF escaneado en JBIG2**, ilegible para todo lo demas: `pdftotext`
  no esta, poppler no esta, el extractor por zlib no sirve). Estan las 28 del articulo
  primero que se pudieron leer y las 12 del segundo. Dos filas salieron con el nombre
  repetido de la vecina.
  **La leccion que costo dos pasadas:** una norma de veda trae VARIAS tablas con efectos
  juridicos distintos. La primera transcripcion las aplano en una lista de 49 y colaba
  como veda de Cornare siete especies que son de la Resolucion 0316 de 1974. El esquema
  de `lib/transcribir.js` ahora exige un grupo por tabla. **Nunca aceptar una
  transcripcion plana.**
  El control de calidad que hizo fiable el resto: el articulo tercero recopila esa
  resolucion de 1974, cuyas 7 especies ya teniamos por otra fuente, y coincidieron las 7.
  Buscar siempre un grupo de control asi.
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

1. **Medir la identificación por foto.** Es lo importante y lo único sin tocar. Andrés
   tiene la app instalada desde el release `bio-v1`.
2. **Las 2 especies que faltan del Acuerdo 404** y los Acuerdos 262 de 2011 y 207 de 2008,
   que no estan publicados en la web de Cornare (probado: dan 404). Habria que pedirlos.
3. Nombres comunes: solo hay 878, de las especies amenazadas. GBIF cubre el resto en
   caliente, pero un índice local más grande ahorraría llamadas.

## Trato con el usuario

No es desarrollador. Comandos completos listos para pegar, en PowerShell (`;` en vez de
`&&`, `curl.exe` en vez de `curl`), con los valores ya sustituidos. Prefiere que se hagan
las cosas por él.

Nunca escribir su `GEMINI_API_KEY` en ningún archivo: la pone él en el panel de Render.
