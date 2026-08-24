---
name: xiloscan
description: Contexto completo del proyecto XiloScan (app Android + backend Gemini para identificar maderas por el corte transversal). Invócala al retomar el proyecto tras reiniciar el contexto, antes de tocar código, desplegar o diagnosticar fallos.
---

# XiloScan

App Android que identifica especies de madera fotografiando el corte transversal.
Para Andrés, del comercio maderero del Valle de Aburrá (Medellín, Colombia).

## Estado y accesos

| Qué | Dónde |
| --- | --- |
| Repositorio | https://github.com/anmarinoc-sketch/maderas-app (público) |
| Carpeta local | `C:\Users\amo\Desktop\Claude\maderas-app` |
| Backend | https://madera-backend.onrender.com (Render, plan gratuito) |
| APK | Release con etiqueta `v*` (el primero, `v1`, es del 23-08-2026), o el artefacto `xiloscan-apk` de cada ejecución de Actions |
| Clave de firma | `android/keystore/xiloscan.p12`, versionada, contraseña `xiloscan` |

Estructura: `android/` (Kotlin + Compose) y `backend/` (Node 22 + Express).

**El repositorio ya no es solo de XiloScan.** Desde el 23-08-2026 alberga también
**BioScan** (`android-bioscan/`), una app que identifica especies de flora y fauna y dice
si están vedadas o amenazadas. Comparte backend, clave de firma y CI; si vas a tocar
`backend/` o los workflows, invoca también la skill `bioscan`. Lo que cambió en XiloScan:
la rotación de modelos salió de `lib/gemini.js` a `lib/motor-gemini.js` para que las dos
apps la compartan con claves distintas. El comportamiento de XiloScan es el mismo.

## Cómo trabajar

Cambio → commit → push. La CI compila el APK; Render redespliega **solo** si el cambio
toca `backend/`. No hay forma de compilar Android en local: no hay JDK 17 ni SDK.

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app; git push
```

Verificar sin credenciales, por la API pública:

```bash
curl -s "https://api.github.com/repos/anmarinoc-sketch/maderas-app/actions/runs?per_page=3"
curl -s https://madera-backend.onrender.com/health
```

**No hay acceso a los logs de Actions** (exigen permisos de admin) ni a los de Render. Los
fallos de compilación se diagnostican leyendo el código, no el log. Ha funcionado siempre.

## Restricciones que condicionan el diseño

**Cuota de Gemini: 20 peticiones diarias POR MODELO** en el nivel gratuito
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). El usuario **no pagará más**; su
suscripción a la app de Gemini no cubre la API. Por eso el backend rota entre 8 modelos
(`config.geminiModelos`): al agotarse uno se aparta hasta la medianoche del Pacífico y se
pasa al siguiente, dando unas 160 identificaciones diarias.

**El disco de Render es efímero.** Todo lo que deba perdurar va al repositorio. Las
verificaciones del usuario se respaldan con el workflow `respaldo-verificaciones.yml`.

**Render duerme el servicio** tras 15 min sin tráfico. El propio backend se auto-llama
cada 10 min usando `RENDER_EXTERNAL_URL` (antes había un cron en Actions que generaba 144
ejecuciones diarias y enterraba las compilaciones).

## Decisiones tomadas y por qué

**La clave de determinación** (`backend/src/lib/referencia.js`) sale de las 34 fichas del
curso de Anatomía e Identificación de Maderas de la UNAL sede Medellín, extraídas del PDF
del usuario a `backend/src/datos/maderas-valle-aburra.json`. Se envía como clave
dicotómica, no como lista: **el primer corte NO es la porosidad** — 30 de las 32
latifoliadas son de porosidad difusa y ese carácter casi no separa. Reparte el parénquima
axial, en seis grupos. De cada ficha solo va lo visible en la testa; se descartan líneas
vasculares, estratificación, olor, brillo y textura. Prompt de sistema: ~30.000 caracteres.

**La confianza está calibrada a la fuerza** en el prompt, con escala explícita y prohibición
de pasar de 0,5 con menos de tres caracteres coincidentes. Antes decía 0,93 al acertar y
0,86 al fallar, es decir, era inútil. Al calibrarla mejoró también el acierto. Por debajo de
0,6 la app presenta el resultado como «candidata sin confirmar».

**Las correcciones del usuario** (`aprendizaje.js`) se inyectan en el prompt como avisos de
errores comprobados. **Gemini no aprende entre peticiones**: esto es memoria prestada, no
entrenamiento. No prometer lo contrario.

**Cada verificación va atada a su foto** (`huella.js`). El aviso genérico no bastaba: el
usuario cargaba la misma imagen, la corregía y seguía fallando, porque nada relacionaba el
aviso con la foto que el modelo tenía delante. Van dos huellas: `sha256` de los bytes, que
calcula el servidor y solo casa con el archivo idéntico, y un **dHash de 64 bits que calcula
la app** —tiene el bitmap decodificado; el backend no, y meter `sharp` en Render por esto no
compensa—. Casan hasta 8 bits de distancia de Hamming: en pruebas, variantes de la misma
pieza quedan a 1-2 bits y piezas distintas a 27. El dato de la especie viaja en el **turno de
usuario, pegado a la imagen**, no en la instrucción de sistema. Se le sigue pidiendo que
describa la anatomía y avise si la contradice: una huella puede casar por parecido y una
verificación no es dogma. El respaldo diario conserva las huellas. **Probado en campo por el
usuario el 22-08-2026: funciona.** Ojo, las verificaciones anteriores a esa fecha no llevan
huella y solo valen como avisos genéricos.

**Los nombres se emparejan con la guía** (`nombreCanonico` en `referencia.js`). El usuario
escribe «chingale» unas veces y «Jacaranda copaia» otras; sin unificar, los tres fallos del
chingalé se repartían entre dos avisos y ninguno pesaba.

**Método de campo:** bisturí o navaja (cortar, no raspar) y humedecer con agua. Es el del
curso de la UNAL. **Nunca recomendar lijar**, error que hubo al principio.

**Lenguaje:** «la cara del corte» o «la punta de la pieza», no «la testa»; «la veta», no
«la fibra». El usuario es del sector, no de laboratorio.

## Fuentes de anatomía verificadas (24-08-2026)

Todas abiertas y comprobadas, no por el título. Copias descargadas en
`C:\Users\amo\Desktop\Referencias maderas\`.

| Fuente | Qué trae | Uso |
| --- | --- | --- |
| **SERFOR 2022** (Perú) — [PDF](https://repositorio.serfor.gob.pe/bitstream/SERFOR/944/3/SERFOR%202022%20-%20Manual%20Identificacion%20Madera.pdf) | 51 fichas legibles (anuncia 64): porosidad, poros, parénquima, radios, inclusiones, y **láminas transversales a 10x y 20x** | La mejor. Misma estructura que la clave |
| **Commercial Timbers** — [Delta-Intkey](https://www.delta-intkey.com/wood/en/index.htm) | Descripciones IAWA con medidas (µm, poros/mm²). Una URL por especie | La más precisa. 13 de 14 consultadas |
| **CITESwoodID** — [app](https://www.citeswoodid.app/es/) | 46 CITES y 34 que se les parecen, en español | Para el ángulo legal |
| **ID Maderas** — [UNODC](https://www.unodc.org/peruandecuador/es/noticias/2021/aplicativo-movil-forense-de-identificacin-de-maderas-app-id-maderas.html) | 40 peruanas, los tres cortes | Se solapa con SERFOR, que es mejor |
| **COVIMA** — [MinAmbiente](https://www.minambiente.gov.co/ya-esta-disponible-covima-2-0-app-para-la-conservacion-de-los-bosques-del-pais/) | 55 especies colombianas oficiales | **Lista de objetivos**, no de contenido |
| **InsideWood** — [NC State](https://insidewood.lib.ncsu.edu/welcome) | Lo más completo que existe | **Solo si XiloScan NO se monetiza** |
| **Xylorix PocketWood** | Producto comercial | Consultar sí, copiar no |

**Descartadas.** «Maderas de Colombia» (WWF 2013) no trae **ni un corte transversal**: 37
tangenciales, 8 radiales, 0 transversales. Es un catálogo comercial. **Xylotron** (USDA) es
abierto de verdad pero es hardware calibrado; sus modelos no sirven con fotos de celular.

**Cruce con las 34 actuales:** 5 coinciden en especie con el SERFOR (cedro, lirio, puerto,
sande, tornillo), 7 en género, y 22 hay que sacarlas de Delta-Intkey. En sentido contrario,
el SERFOR aporta 34 especies que faltan, varias comerciales también en Colombia (caoba,
ceiba, catahua, moral, quinilla).

**El repositorio es público:** las fichas se redactan citando la fuente, no se copian.

**Para leer esos PDFs** no hay Python ni poppler en el equipo. Sirve `pdfjs-dist` por npm.
El manual del SERFOR trae 2 páginas por hoja y 2 columnas por página: hay que repartir los
trozos de texto por su coordenada X en 4 bandas, o el texto de dos especies sale
entrelazado renglón a renglón.

## El acierto, medido (24-08-2026)

Primera medición real del proyecto. Banco: **29 láminas de la propia guía de la UNAL**,
una por especie, construido con `herramientas/construir-banco-guia.js` y guardado en
`C:\Users\amo\Desktop\Referencias maderas\banco de pruebas\`. Se mide con
`herramientas/evaluar-acierto.js`, que cuenta especie y género por separado.

| | Antes del arreglo del paso 4 |
| --- | --- |
| Acierto de especie | **4/29 — 14 %** |
| Acierto de grupo anatómico | **18/28 — 64 %** |
| Confianza media que se daba | 0,65 |

**El hallazgo que lo explica todo: sesgo de posición.** De 29 respuestas, 10 fueron
*Hymenaea courbaril* y 5 *Cariniana pyriformis*. No es casualidad — encabezan el grupo A y
el grupo C. Contando el ciprés, que encabeza coníferas, **17 de 29 respuestas fueron “la
primera ficha de un grupo”**. El modelo lee bien el parénquima y elige bien el grupo (64 %,
la parte difícil); al llegar al paso 4 se quedaba con el primero de la lista porque ese
paso era una frase, no un procedimiento.

**No era culpa de las fichas ni de la vista del modelo.** Antes de tocar una ficha, mirar
la distribución de respuestas: si unas pocas especies acaparan, es sesgo, no anatomía.

El arreglo: cada grupo lleva delante una tabla (poros/10mm2 y tamaño, ordenada por
cantidad), el paso 4 es un procedimiento —estimar, situar, descartar por escrito, y si
quedan varias responder al nivel que se sostenga— y hay una regla explícita contra elegir
la primera del grupo.

**La confianza volvió a inflarse.** 0,65 de media con 14 % de acierto real. Ya pasó antes
y se calibró; hay que revisarla cada vez que se mida.

**`/health` publica `apps.xiloscan.prompt_caracteres`**: es la única forma de saber desde
fuera si Render ya desplegó un cambio del prompt. Comprobarlo SIEMPRE antes de medir, o se
mide una versión que ya no es la que se cree.

## Trampas ya pisadas

- **Firma del APK:** cada compilación generaba su clave y Android rechazaba actualizar
  («conflicto con un paquete»). Resuelto versionando la clave. El secreto
  `DEBUG_KEYSTORE_B64` mantiene prioridad si algún día se saca del repositorio.
- **`keepAliveTimeout`** de Node se quedaba en 5 s y Render daba por caídas las conexiones
  reutilizadas: se perdía la mitad de las peticiones sin dejar rastro en los logs.
- **Gson no aplica los valores por defecto de Kotlin**: los modelos son nullable a propósito.
- **Generar Kotlin con scripts de shell** ha costado dos compilaciones rotas (comillas
  simples convertidas en literales de carácter, interpolaciones comidas). Usar Edit/Write.
- **Iconos de Material**: verificar que existen antes de usarlos; `Rotate90DegreesCcw` y
  `RestartAlt` hubo que cambiarlos. `material-icons-extended` sí está entre las
  dependencias, así que el problema no era el paquete: esos dos nombres no existen.
  Comprobar el nombre exacto, no asumir que basta con incluir el paquete.
- **Caracteres invisibles al escribir código por shell**: un rango de marcas diacríticas
  quedó como bytes literales dentro de un regex. Funcionaba, pero era intocable. Escribir el
  fuente en ASCII (`\p{Diacritic}`, `\uXXXX`) y comprobarlo con `od -c` si hay dudas.
- **La caché de la web de GitHub** engaña: comprobar el estado por la API.
- **Fabricar el banco de pruebas desde el PDF de la guía sale mal por orden de
  aparición.** Las páginas referencian 99 imágenes y del archivo salen 81 JPEG de 400x400
  o más: el desfase corre la asignación y las láminas quedan con la especie equivocada. Se
  detectó porque la etiquetada como chingalé resultó ser tornillo. Para hacerlo bien hay
  que leer de cada página su `/Resources /XObject` y cruzar por número de objeto. Las 34
  fichas están en las páginas 37-66, una por página, y el texto sale limpio con
  `pdfjs-dist`. **Un banco mal etiquetado es peor que no tener banco:** da un número de
  acierto falso y hace “corregir” lo que estaba bien.

## Qué queda pendiente

**Medir el acierto.** ~~Sigue sin hacerse~~ — hecho el 24-08-2026, ver la sección de arriba. El PDF de la guía está en
`C:\Users\amo\Downloads\Anatomia e identificacion de maderas.pdf`: de ahí salen las 34
láminas y el banco de pruebas (POST de cada lámina y comparación con la especie real de su
página). Cuesta 34 peticiones de las ~160 diarias. Las 8 verificaciones del usuario dan 2
aciertos y 6 fallos; **chingalé** falló 3 de 3, siempre confundido con leguminosas:
sospechar de su ficha en la clave. **Pista concreta:** la ficha de la UNAL dice poros
«predominantemente solitarios» y Commercial Timbers (Thünen) dice «in multiples, commonly in
short (2-3 vessels) radial rows». Si el modelo busca poros solitarios y ve filas radiales,
descarta chingalé y se va a las leguminosas — que es justo lo que pasa. Comprobar contando
en la lámina antes de cambiar la ficha. Al medir, contar solo fotos sin verificación previa: una
lámina ya verificada acierta por la huella y no mide nada.

**Banco de imágenes de referencia.** Enviar unas pocas fotos verificadas como ejemplos
etiquetados junto a la consulta. Es lo más parecido a enseñarle. Pendiente por el coste en
tokens y por decidir dónde viven las imágenes, dado el disco efímero.

## Trato con el usuario

No es desarrollador. Comandos completos listos para pegar, en PowerShell (`;` en vez de
`&&`, `curl.exe` en vez de `curl`). Dejar los valores ya sustituidos: una vez ejecutó
literalmente una URL con `TU_USUARIO`. Prefiere que se hagan las cosas por él.

Nunca escribir su `GEMINI_API_KEY` en ningún archivo: la pone él en el panel de Render.
