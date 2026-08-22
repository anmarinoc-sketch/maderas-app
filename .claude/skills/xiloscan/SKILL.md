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
| APK | Artefacto `xiloscan-apk` de cada ejecución de Actions |
| Clave de firma | `android/keystore/xiloscan.p12`, versionada, contraseña `xiloscan` |

Estructura: `android/` (Kotlin + Compose) y `backend/` (Node 22 + Express).

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

## Qué queda pendiente

**Medir el acierto.** Es lo importante y sigue sin hacerse. El PDF de la guía está en
`C:\Users\amo\Downloads\Anatomia e identificacion de maderas.pdf`: de ahí salen las 34
láminas y el banco de pruebas (POST de cada lámina y comparación con la especie real de su
página). Cuesta 34 peticiones de las ~160 diarias. Las 8 verificaciones del usuario dan 2
aciertos y 6 fallos; **chingalé** falló 3 de 3, siempre confundido con leguminosas:
sospechar de su ficha en la clave. Al medir, contar solo fotos sin verificación previa: una
lámina ya verificada acierta por la huella y no mide nada.

**Banco de imágenes de referencia.** Enviar unas pocas fotos verificadas como ejemplos
etiquetados junto a la consulta. Es lo más parecido a enseñarle. Pendiente por el coste en
tokens y por decidir dónde viven las imágenes, dado el disco efímero.

## Trato con el usuario

No es desarrollador. Comandos completos listos para pegar, en PowerShell (`;` en vez de
`&&`, `curl.exe` en vez de `curl`). Dejar los valores ya sustituidos: una vez ejecutó
literalmente una URL con `TU_USUARIO`. Prefiere que se hagan las cosas por él.

Nunca escribir su `GEMINI_API_KEY` en ningún archivo: la pone él en el panel de Render.
