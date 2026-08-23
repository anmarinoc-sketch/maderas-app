# BioScan

App Android que dice, de una especie de flora o fauna colombiana, si es **nativa o
exótica**, si es **endémica**, en qué **categoría de amenaza** está, si está **vedada**
—veda nacional o regional— y cuál es su **rango de distribución**.

Se le pregunta de dos formas: escribiendo el nombre (común o científico) o haciéndole una
foto.

```
                  ┌─ nombre ─┐
App BioScan ──────┤          ├──▶ backend ──┬──▶ listas oficiales (en disco)
                  └─ foto ───┘              └──▶ Gemini (solo lo que no es normativo)
```

Es una app **aparte de XiloScan**, con su propio icono y su propio APK, pero comparte el
mismo servidor. El backend vive en `../backend`.

## La idea que sostiene todo

Los datos legales y de conservación **no se le preguntan al modelo**.

Gemini no tiene base de datos. Si se le pregunta si una especie está vedada, no consulta
nada: redacta la respuesta más plausible, y los números de resolución que produce son
inventados con total seguridad. En una app que se consulta antes de cortar un árbol eso
es un daño real.

Así que el trabajo va repartido:

| Quién | Qué hace |
| --- | --- |
| Las listas oficiales, en disco | Veda, amenaza, endemismo, origen, CITES, distribución |
| Gemini | Reconocer la especie de una foto y redactar la explicación |

Y se nota en pantalla: cada bloque de la ficha lleva su etiqueta, **Lista oficial** o
**Redactado por IA**, con estilos distintos. Mezclarlos daría el mismo peso a un número
de resolución verificado y a una frase bien escrita.

## Consecuencia práctica: funciona sin cuota

Las listas se responden desde disco, en microsegundos y sin gastar ninguna consulta de
Gemini. Consultar por nombre una especie que esté en las listas cuesta **cero peticiones**
si se apaga la explicación redactada en Ajustes.

El día que se agote la cuota diaria, la app sigue diciendo si algo está vedado.

## Cómo resuelve un nombre

Cuatro pasos, de más barato a más caro, y para en cuanto uno responde:

1. **Es un nombre científico** que está en las listas → ficha directa.
2. **Índice local de nombres comunes** (cubre las especies amenazadas).
3. **GBIF**, API pública y gratuita, sin clave.
4. **El modelo** lo propone y las listas lo verifican.

Los tres primeros no gastan cuota.

Cuando un nombre designa varias especies, **la app hace elegir**. No adivina. En cada
candidata enseña lo que hace que la elección importe: si es endémica, su categoría de
amenaza y si está vedada. Con «chingalé» salen dos, *Astrocaryum malybo* (endémica y en
peligro) y *Jacaranda copaia* (ninguna de las dos cosas).

## Lo que la app NO puede decirte

- **El listado de Cornare está incompleto.** Del Acuerdo 404 de 2020 solo hay transcritas
  10 de sus 30 especies, porque el acta original es un PDF escaneado. Los Acuerdos 262 de
  2011 y 207 de 2008 no están transcritos. La app lo avisa en cada consulta.
- **Solo hay vedas nacionales y de Corantioquia.** Las demás corporaciones no están
  cargadas.
- **El AMVA no expide vedas de especies**: es autoridad urbana y regula el arbolado. En el
  Valle de Aburrá aplican las nacionales y las de Corantioquia.
- **De fauna solo hay categoría de amenaza.** El Catálogo de Plantas cubre únicamente
  flora, así que de un animal no habrá origen, endemismo ni distribución oficiales; eso lo
  redacta el modelo y va marcado como tal.
- **Los apéndices CITES son de 2023** y cambian cada dos o tres años. Para exportar hay
  que confirmarlos en speciesplus.net.

Por eso el aviso de cobertura aparece **siempre, haya veda o no**: «no me consta» no es lo
mismo que «no está vedada».

## Compilar

No se compila en local: no hay JDK 17 ni SDK en el equipo del proyecto. Lo hace la CI.

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app; git push
```

El workflow `apk-bioscan.yml` deja el APK como artefacto **`bioscan-apk`** de la ejecución.
Para publicar un release descargable desde el móvil, etiqueta con `bio-v*`:

```bash
cd C:\Users\amo\Desktop\Claude\maderas-app; git tag bio-v1; git push origin bio-v1
```

Firma con la **misma clave que XiloScan** (`../android/keystore/xiloscan.p12`). No hay
conflicto porque el `applicationId` es distinto: para Android son dos apps sin relación,
solo firmadas por el mismo autor. La clave estable es lo que permite instalar una versión
nueva encima de la anterior sin desinstalar.

## Ajustes

| Ajuste | Para qué |
| --- | --- |
| Explicación redactada | Apagarla deja la app sin gastar cuota de IA al consultar por nombre |
| URL del servidor | El mismo backend que XiloScan; se puede apuntar a otro sin recompilar |
| Clave de la app | Cabecera `X-App-Key`, solo si el backend la exige |
