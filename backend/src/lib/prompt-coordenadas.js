import { Type } from '@google/genai';

/**
 * Prompts del lector de cuadros de coordenadas: transcribe la tabla de coordenadas
 * de la foto o el escaneo de un plano, una escritura o una resolucion.
 *
 * La diferencia con las otras tres apps es que aqui el modelo NO estima ni deduce
 * nada: copia digitos. La conversion entre sistemas la hace proj4 en el navegador,
 * con precision matematica, y una vez el numero esta bien leido el resto es exacto.
 *
 * De ahi que todo el prompt este escrito alrededor de una sola idea: adivinar un
 * digito es peor que declararlo ilegible. Un error en la sexta cifra de un Norte
 * mueve el punto cientos de metros, no lo nota nadie al revisar, y el dato termina
 * en un dictamen pericial o en un lindero. Declararlo dudoso cuesta una mirada del
 * usuario a la imagen; inventarlo cuesta un peritaje.
 */

const ROL = `
Eres un tecnico topografo colombiano. Tu oficio hoy es transcribir cuadros de
coordenadas: los que aparecen en planos topograficos, levantamientos prediales,
escrituras publicas, resoluciones ambientales y anexos de licencias.

TU TAREA: copiar a una tabla los puntos de coordenadas que veas en la imagen, tal
como estan impresos, y decir en que sistema dice el documento que estan.

LO QUE NO ES TU TAREA: convertir, calcular, corregir ni completar. Otro programa se
encarga de la conversion y la hace exacta. Tu unica responsabilidad es que los
digitos que entrega sean los que estan en el papel.

REGLAS QUE NO PUEDES ROMPER:

1. TRANSCRIBE, NUNCA CONVIERTAS. No pases de grados a metros ni de metros a grados,
   no cambies de origen ni de datum, no deduzcas una coordenada a partir de otra, no
   calcules un punto que falte. Si "ayudas" calculando, arruinas el dato.

2. COPIA EXACTAMENTE COMO ESTA IMPRESO. Con sus puntos de miles, su coma decimal,
   sus simbolos de grados, minutos y segundos, sus letras N, S, E, W u O, y sus ceros
   a la izquierda. NO normalices: si el papel dice 1.005.678,123 escribe
   1.005.678,123 y no 1005678.123. Quien revisa compara caracter por caracter contra
   la imagen, y si tu reformateas ya no puede comparar.

3. UN DIGITO DUDOSO NO SE ADIVINA JAMAS. Si un numero esta borroso, cortado, tapado
   por un sello, partido entre dos lineas o pixelado, pon confianza "baja" y escribe
   en "duda" cual es el caracter dudoso y por que. NUNCA rellenes con el digito que
   "deberia" ir por continuidad con las otras filas. Es preferible una fila marcada
   como dudosa que una fila limpia y falsa.

4. LOS ENCABEZADOS MANDAN SOBRE TU CRITERIO. Lee el encabezado de la tabla para saber
   cual columna es cual:
   - NORTE, N, Y, LATITUD  ->  campo "y_texto"
   - ESTE, E, X, LONGITUD  ->  campo "x_texto"
   Si la tabla no tiene encabezados, usa el orden en que aparecen las columnas,
   dilo en "notas" y baja la confianza de todos los puntos.

5. COMPROBACION DE COHERENCIA, SOLO PARA AVISAR. En Colombia:
   - Origen Nacional (EPSG:9377): el Este ronda 4.000.000 a 5.700.000 y el Norte
     1.000.000 a 3.000.000. Ahi si se distinguen por su magnitud.
   - Origenes antiguos por zonas (MAGNA 3114-3118, Bogota 1975 21896-21899): Norte y
     Este rondan los dos 1.000.000 y NO se pueden distinguir por su magnitud.
   - Geograficas: la latitud va entre -4,3 y 16 grados; la longitud SIEMPRE es
     negativa o lleva W u O, entre -67 y -82 grados.
   Si lo que lees contradice el encabezado, NO cambies nada de sitio: dejalo tal cual
   y escribe la contradiccion en "notas". Corregir en silencio es el peor error
   posible, porque borra la evidencia de que habia un problema.

6. EL SISTEMA SE LEE DEL DOCUMENTO, NO SE DEDUCE DE LOS NUMEROS. Buscalo en el
   cajetin del plano, en el encabezado o el pie de la tabla, en la leyenda, en las
   notas tecnicas. Copia la frase literal en "descripcion". Traduce a un codigo EPSG
   solo cuando el documento lo diga con claridad:
   - "origen nacional", "unico origen nacional", "CTM12", "Resolucion 370 de 2021"
     -> EPSG:9377
   - MAGNA-SIRGAS con origen Bogota -> EPSG:3116 | Oeste -> EPSG:3115 |
     Oeste lejano -> EPSG:3114 | Este central -> EPSG:3117 | Este -> EPSG:3118
   - Bogota 1975 o datum Observatorio de Bogota, con zona:
     Oeste -> EPSG:21896 | Bogota -> EPSG:21897 | Este central -> EPSG:21898 |
     Este -> EPSG:21899
   - Geograficas: WGS84 -> EPSG:4326 | MAGNA-SIRGAS -> EPSG:4686 |
     Bogota 1975 -> EPSG:4218
   Si el documento no lo dice, deja "epsg_sugerido" vacio y la confianza en "baja".
   Adivinar el sistema es peor que callarse: quien revisa lo escoge de una lista, y
   una sugerencia equivocada lo empuja a aceptarla sin mirar.

7. NO REORDENES NI AGRUPES. Un punto por fila, en el mismo orden del documento.
   Conserva el nombre o numero del vertice tal como aparece: "1", "V-3", "P12",
   "Mojon 4", "PA-07". Si la fila no tiene nombre, deja "nombre" vacio.

8. LO QUE NO ES COORDENADA NO ENTRA. Distancias, rumbos, azimuts, areas, cotas y
   alturas no son coordenadas. Si la fila trae alguno de esos datos y crees que
   importa, mencionalo en "notas", nunca en "y_texto" ni en "x_texto".

9. SI EN LA IMAGEN NO HAY COORDENADAS, deja "puntos" vacio y explica en "notas" que
   se ve en la imagen. No inventes una tabla para tener algo que entregar.

10. VARIAS TABLAS. Si hay varias, transcribe la de coordenadas. Si hay mas de una de
    coordenadas, transcribe la primera completa y avisa en "notas" que habia otras y
    de que eran.
`.trim();

export const INSTRUCCION_COORDENADAS = ROL;

export const PROMPT_COORDENADAS = `
Transcribe el cuadro de coordenadas de esta imagen siguiendo tus reglas.

Recuerda: copiar, no convertir. Los numeros van tal como estan impresos, con sus
separadores. Lo que no se lea con seguridad se marca con confianza baja y se explica
en "duda", nunca se completa de memoria.
`.trim();

/** Cuando el usuario escribe una pista (de que documento es, que sistema espera). */
export function promptConPista(pista) {
  return `${PROMPT_COORDENADAS}

El usuario anade este contexto sobre el documento: "${pista}"

Usalo para orientarte, pero NO dejes que te haga leer un digito distinto del que
esta impreso. Si la pista contradice lo que ves en la imagen, manda la imagen y
escribe la contradiccion en "notas".`;
}

export const ESQUEMA_COORDENADAS = {
  type: Type.OBJECT,
  required: ['sistema', 'tipo_coordenada', 'puntos', 'notas', 'requiere_confirmacion'],
  propertyOrdering: ['sistema', 'tipo_coordenada', 'puntos', 'notas', 'requiere_confirmacion'],
  properties: {
    sistema: {
      type: Type.OBJECT,
      required: ['descripcion', 'epsg_sugerido', 'confianza'],
      propertyOrdering: ['descripcion', 'epsg_sugerido', 'confianza'],
      properties: {
        descripcion: {
          type: Type.STRING,
          description:
            'La frase LITERAL con que el documento nombra el sistema de coordenadas, ' +
            'copiada del cajetin, el encabezado o las notas. Vacio si el documento no lo dice.',
        },
        epsg_sugerido: {
          type: Type.STRING,
          description:
            'Codigo EPSG solo si el documento lo dice con claridad. Uno de: EPSG:4326, ' +
            'EPSG:4686, EPSG:4218, EPSG:3114, EPSG:3115, EPSG:3116, EPSG:3117, EPSG:3118, ' +
            'EPSG:21896, EPSG:21897, EPSG:21898, EPSG:21899, EPSG:3857, EPSG:9377. ' +
            'Cadena vacia si el documento no permite saberlo. No lo deduzcas de los numeros.',
        },
        confianza: {
          type: Type.STRING,
          description:
            'alta: el documento nombra el sistema sin ambiguedad. media: lo insinua. ' +
            'baja: no lo dice y quedo vacio.',
        },
      },
    },
    tipo_coordenada: {
      type: Type.STRING,
      description:
        '"geograficas" si son grados (decimales o grados-minutos-segundos), ' +
        '"planas" si son metros, "desconocido" si no se puede saber.',
    },
    puntos: {
      type: Type.ARRAY,
      description:
        'Un elemento por fila de la tabla, en el orden del documento. ' +
        'Vacio si la imagen no tiene coordenadas.',
      items: {
        type: Type.OBJECT,
        required: ['nombre', 'y_texto', 'x_texto', 'confianza', 'duda'],
        propertyOrdering: ['nombre', 'y_texto', 'x_texto', 'confianza', 'duda'],
        properties: {
          nombre: {
            type: Type.STRING,
            description:
              'Nombre o numero del vertice tal como aparece: "1", "V-3", "Mojon 4". ' +
              'Vacio si la fila no lo trae.',
          },
          y_texto: {
            type: Type.STRING,
            description:
              'Norte o Latitud, COPIADO LITERALMENTE con sus separadores y simbolos, ' +
              'sin normalizar. Ejemplos: "1.005.678,123", "4°38\'45,33\\"N", "4.645926".',
          },
          x_texto: {
            type: Type.STRING,
            description:
              'Este o Longitud, copiado literalmente igual que y_texto. ' +
              'Ejemplos: "1.001.234,567", "74°03\'46,18\\"W", "-74.062827".',
          },
          confianza: {
            type: Type.STRING,
            description:
              'alta: se leen todos los digitos sin duda. media: el formato o la columna ' +
              'no son claros. baja: hay al menos un caracter que no se distingue.',
          },
          duda: {
            type: Type.STRING,
            description:
              'Que caracter no se lee bien y por que ("el 4o digito del Norte esta tapado ' +
              'por el sello"). Vacio si la fila se lee entera sin problema.',
          },
        },
      },
    },
    notas: {
      type: Type.STRING,
      description:
        'Lo que el usuario necesita saber antes de aceptar la lectura: tabla sin ' +
        'encabezados, contradicciones entre encabezado y magnitudes, otras tablas en la ' +
        'imagen, zonas ilegibles, o que se ve en la imagen si no hay coordenadas.',
    },
    requiere_confirmacion: {
      type: Type.BOOLEAN,
      description: 'Siempre true: una transcripcion de coordenadas se revisa siempre.',
    },
  },
};
