import { Type } from '@google/genai';

/**
 * Prompts de BioScan.
 *
 * Reparto de trabajo, que es lo que sostiene todo el diseño:
 *   - El modelo MIRA y RECONOCE. Eso lo hace bien.
 *   - Las listas oficiales DICTAMINAN. Veda, categoria de amenaza, endemismo, origen
 *     y distribucion salen de src/datos, no de aqui.
 *
 * Por eso el prompt le prohibe expresamente pronunciarse sobre lo normativo. Un modelo
 * de lenguaje al que se le pregunta si una especie esta vedada no consulta nada:
 * redacta la respuesta mas plausible, y los numeros de resolucion que produce son
 * inventados con una seguridad total. Aqui eso seria un dano real, porque quien lee
 * toma decisiones de compra y de aprovechamiento con consecuencias legales.
 */

const ROL_COMUN = `
Eres un biologo de campo colombiano con experiencia en flora y fauna neotropical, y en
particular en la biodiversidad de Antioquia y el Valle de Aburra. Trabajas para
profesionales que no son biologos: gente del sector forestal y maderero que necesita
saber que tiene delante.

LO QUE NO DEBES HACER NUNCA:
- No digas si una especie esta vedada, ni cites resoluciones, acuerdos, decretos ni
  numeros de norma. NO LOS SABES: los recordarias mal y quien te lee actuaria sobre un
  dato falso. De la parte legal se encarga el sistema, con las listas oficiales
  cargadas. Si te preguntan por vedas, deja el campo vacio.
- No afirmes categorias de amenaza (CR, EN, VU) ni apendices CITES. Las pone el sistema.
- No afirmes que una especie es endemica ni des su distribucion por departamentos. Las
  pone el sistema.
- No inventes. Si un rasgo no se ve o no lo sabes, escribe "no visible", "indeterminado"
  o "desconocido".

LENGUAJE: quien lee trabaja en el campo o en el comercio de la madera, no en un
laboratorio. Escribe claro y directo. Los terminos tecnicos, solo donde hagan falta y
explicados.

Responde SIEMPRE en espanol y unicamente con el JSON del esquema pedido.
`.trim();

/* ------------------------------------------------- identificacion por fotografia */

export const INSTRUCCION_FOTO = `
${ROL_COMUN}

METODO DE TRABAJO (aplicalo en este orden):
1. Decide si la imagen muestra un ser vivo (o su rastro: hoja, corteza, fruto, flor,
   pluma, huella, canto anotado) y si la calidad permite un analisis fiable.
2. Di si es flora o fauna, y a que grupo pertenece (arbol, palma, orquidea, ave,
   mamifero, reptil, anfibio, insecto, etc.).
3. DESCRIBE lo que ves antes de proponer un nombre: forma y borde de la hoja,
   disposicion, nervadura, corteza, flor, fruto; o en fauna, silueta, pico, patas,
   coloracion, marcas, tamano aparente. Esta descripcion es la que sostiene el nombre.
4. Solo entonces propon la identificacion mas probable y hasta tres alternativas,
   justificando cada una con los rasgos observados.
5. Ten presente el contexto: lo mas probable es que la foto sea de Colombia, y muy
   posiblemente de Antioquia. Pero si lo que ves es claramente una especie cultivada u
   ornamental de otro continente, dilo: en ciudad abundan.

CALIBRACION DE LA CONFIANZA. Esto pesa tanto como el nombre. Quien usa la app decide
sobre lo que le digas, y una confianza inflada hace mas dano que un "no se". Usa esta
escala y no la infles:
  0,0-0,3  No se puede precisar. Imagen insuficiente o sin caracteres diagnosticos.
  0,3-0,5  Solo alcanzas la familia o un grupo, o dudas entre varias especies.
  0,5-0,7  Genero probable, o especie con tres caracteres coincidentes.
  0,7-0,9  Especie muy probable: cuatro o mas caracteres independientes coinciden y
           ninguno la contradice.
  0,9-1,0  Reservado a especies inconfundibles y bien visibles en la foto.
Si te apoyas en menos de tres caracteres, la confianza NO puede pasar de 0,5.
Si dos especies encajan casi igual de bien, ninguna puede superar 0,5: repartelas entre
la principal y las alternativas.

Muchos grupos NO se pueden llevar a especie con una foto: hongos, la mayoria de
insectos, pastos, muchas Lauraceae y Melastomataceae. En esos casos quedate en el
genero o la familia, dilo en las limitaciones, y baja la confianza.
`.trim();

export const PROMPT_FOTO = `
Identifica la especie que aparece en esta fotografia.

Rellena todos los campos del esquema: si es un ser vivo, calidad de la imagen, si es
flora o fauna, los caracteres que observas, el nombre comun y cientifico mas probables,
la confianza calibrada, las alternativas, el habitat y la historia natural, por que
importa ecologicamente, las limitaciones del analisis y que hacer para mejorar la foto.

Recuerda: nada de vedas, normas, categorias de amenaza, CITES, endemismo ni
distribucion por departamentos. De eso se encarga el sistema.
`.trim();

export const ESQUEMA_FOTO = {
  type: Type.OBJECT,
  required: [
    'es_ser_vivo',
    'calidad_imagen',
    'grupo',
    'tipo_de_organismo',
    'caracteres_observados',
    'nombre_comun',
    'nombres_comunes_alternativos',
    'nombre_cientifico',
    'familia',
    'confianza',
    'nivel_alcanzado',
    'alternativas',
    'habitat',
    'historia_natural',
    'importancia_ecologica',
    'limitaciones',
    'recomendaciones_captura',
  ],
  propertyOrdering: [
    'es_ser_vivo',
    'calidad_imagen',
    'grupo',
    'tipo_de_organismo',
    'caracteres_observados',
    'nombre_comun',
    'nombres_comunes_alternativos',
    'nombre_cientifico',
    'familia',
    'confianza',
    'nivel_alcanzado',
    'alternativas',
    'habitat',
    'historia_natural',
    'importancia_ecologica',
    'limitaciones',
    'recomendaciones_captura',
  ],
  properties: {
    es_ser_vivo: {
      type: Type.BOOLEAN,
      description: 'false si la imagen no muestra un ser vivo ni un rastro suyo.',
    },
    calidad_imagen: {
      type: Type.STRING,
      enum: ['alta', 'media', 'baja', 'insuficiente'],
    },
    grupo: {
      type: Type.STRING,
      enum: ['flora', 'fauna', 'hongo', 'indeterminado'],
    },
    tipo_de_organismo: {
      type: Type.STRING,
      description: 'Arbol, palma, orquidea, helecho, ave, mamifero, reptil, insecto, etc.',
    },
    caracteres_observados: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Rasgos concretos visibles que sostienen la identificacion. Uno por elemento. ' +
        'Es la parte que permite al usuario juzgar si el nombre tiene sentido.',
    },
    nombre_comun: { type: Type.STRING, description: '"desconocido" si no procede.' },
    nombres_comunes_alternativos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Otros nombres con que se conoce, sobre todo los usados en Colombia.',
    },
    nombre_cientifico: {
      type: Type.STRING,
      description:
        'Binomio latino sin autoria. Si solo llegas al genero, escribe "Genero sp."; ' +
        'si solo a la familia, deja "desconocido" y di la familia en su campo.',
    },
    familia: { type: Type.STRING, description: 'Familia biologica.' },
    confianza: { type: Type.NUMBER, description: 'De 0 a 1, calibrada segun la escala dada.' },
    nivel_alcanzado: {
      type: Type.STRING,
      enum: ['especie', 'genero', 'familia', 'grupo', 'ninguno'],
      description: 'Hasta donde llega de verdad la identificacion.',
    },
    alternativas: {
      type: Type.ARRAY,
      description: 'Hasta 3 especies o grupos compatibles con lo observado.',
      items: {
        type: Type.OBJECT,
        required: ['nombre_comun', 'nombre_cientifico', 'familia', 'confianza', 'motivo'],
        propertyOrdering: ['nombre_comun', 'nombre_cientifico', 'familia', 'confianza', 'motivo'],
        properties: {
          nombre_comun: { type: Type.STRING },
          nombre_cientifico: { type: Type.STRING },
          familia: { type: Type.STRING },
          confianza: { type: Type.NUMBER },
          motivo: {
            type: Type.STRING,
            description: 'Rasgos que la apoyan y rasgos que la descartarian.',
          },
        },
      },
    },
    habitat: {
      type: Type.STRING,
      description: 'Donde vive: tipo de bosque o ambiente, y si es de tierra fria o caliente.',
    },
    historia_natural: {
      type: Type.STRING,
      description:
        'Como vive: floracion y fructificacion, dispersion, alimentacion, comportamiento, ' +
        'relaciones con otras especies. Sin datos legales ni de amenaza.',
    },
    importancia_ecologica: {
      type: Type.STRING,
      description:
        'Que papel cumple en su ecosistema y por que importa conservarla, en terminos ' +
        'ecologicos. Nada de categorias oficiales de amenaza: las pone el sistema.',
    },
    limitaciones: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Por que el resultado podria ser erroneo o quedarse corto.',
    },
    recomendaciones_captura: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Que fotografiar para afinar la identificacion: hoja entera con el peciolo, enves, ' +
        'corteza, flor o fruto, la planta completa; en fauna, el perfil, las patas, la cola. ' +
        'En lenguaje llano.',
    },
  },
};

/* ------------------------------------------------------ resolucion de un nombre */

export const INSTRUCCION_NOMBRE = `
${ROL_COMUN}

Te dan un nombre, normalmente comun y usado en Colombia, y tienes que decir a que
especie o especies corresponde.

Un mismo nombre comun designa especies distintas segun la region: "cedro", "roble",
"guayacan" o "laurel" valen para varias cosas muy diferentes. Devuelve TODAS las
candidatas razonables, ordenadas por probabilidad en el contexto colombiano y
antioqueno, y di en que region se usa cada nombre. No elijas por el usuario cuando
haya ambiguedad real.
`.trim();

export function promptDeNombre(texto) {
  return `
A que especie o especies se refiere el nombre "${texto}" en Colombia?

Devuelve hasta cinco candidatas con su nombre cientifico, su familia, los nombres
comunes con que se conocen y donde se usa ese nombre. Si el nombre ya es un nombre
cientifico, devuelvelo corregido y actualizado si hiciera falta, con una sola candidata.

Nada de vedas, normas, amenaza, CITES, endemismo ni distribucion: eso lo pone el sistema.
`.trim();
}

export const ESQUEMA_NOMBRE = {
  type: Type.OBJECT,
  required: ['reconocido', 'candidatas', 'nota'],
  propertyOrdering: ['reconocido', 'candidatas', 'nota'],
  properties: {
    reconocido: {
      type: Type.BOOLEAN,
      description: 'false si el nombre no corresponde a ninguna especie que conozcas.',
    },
    candidatas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['nombre_cientifico', 'nombre_comun', 'familia', 'grupo', 'confianza', 'donde_se_usa'],
        propertyOrdering: [
          'nombre_cientifico',
          'nombre_comun',
          'familia',
          'grupo',
          'confianza',
          'donde_se_usa',
        ],
        properties: {
          nombre_cientifico: { type: Type.STRING, description: 'Binomio latino sin autoria.' },
          nombre_comun: { type: Type.STRING },
          familia: { type: Type.STRING },
          grupo: { type: Type.STRING, enum: ['flora', 'fauna', 'hongo', 'indeterminado'] },
          confianza: { type: Type.NUMBER },
          donde_se_usa: {
            type: Type.STRING,
            description: 'Region de Colombia donde ese nombre comun designa esta especie.',
          },
        },
      },
    },
    nota: {
      type: Type.STRING,
      description: 'Aclaracion breve si el nombre es ambiguo o se confunde con otro.',
    },
  },
};

/* ---------------------------------------------------------------------- relato */

export const INSTRUCCION_RELATO = `
${ROL_COMUN}

Te dan una especie YA IDENTIFICADA y los datos oficiales que el sistema ha encontrado
sobre ella en las listas colombianas. Tu trabajo es explicar, en lenguaje llano, que es
y por que importa.

Los datos oficiales que te pasan son ciertos y ya estan verificados: puedes apoyarte en
ellos y explicarlos, pero NO los contradigas, NO los amplies con normas que creas
recordar y NO anadas categorias ni resoluciones que no vengan en ellos.

UNA EXCEPCION, Y SOLO UNA: si en los datos oficiales el origen figura como
"desconocido", rellena el campo origen_si_no_consta diciendo si la especie es nativa de Colombia
o introducida. Eso pasa sobre todo con la fauna, porque las listas de origen que tiene el
sistema cubren flora y aves. Es conocimiento biologico corriente, no normativo, y quedarse
callado ante "¿es nativa?" de un animal comun no ayuda a nadie. Si de verdad dudas, pon
"desconocido"; no te lo inventes. Del resto de campos oficiales sigues sin poder opinar.
`.trim();

export function promptDeRelato(ficha) {
  /*
   * De un animal, de que come. Es lo primero que pregunta cualquiera que se topa con uno
   * y no sabe que es: si le entra a la huerta, si caza gallinas, si dispersa semillas.
   * En una planta el campo sobra, y pedirlo igual solo invitaria a rellenarlo con algo.
   */
  const alimentacion = ficha.es_fauna
    ? '\n5. De que se alimenta y como consigue el alimento: si es frugivoro, insectivoro, ' +
      'carnivoro, nectarivoro, granivoro u omnivoro, que come en concreto, a que hora del ' +
      'dia se alimenta y que papel cumple con ello (dispersar semillas, polinizar, ' +
      'controlar plagas o roedores). Escribelo en habitos_alimenticios.'
    : '\nDeja habitos_alimenticios vacio: esto es una planta, no un animal.';

  /*
   * Ante una exotica, "por que importa conservarla" es una pregunta mal hecha: lo que hay
   * que contar es que hace aqui y si esta causando problemas.
   */
  const conservacion = ficha.fauna_exotica
    ? '3. En importancia_conservacion NO escribas sobre conservarla en Colombia: es una ' +
      'especie introducida. Cuenta que hace aqui, desde cuando esta, si esta asilvestrada ' +
      'y si desplaza o afecta a la fauna nativa. Sin categorias ni normas.'
    : '3. Por que importa conservarla, explicando lo que digan los datos oficiales de arriba\n' +
      '   sin anadir ninguna norma ni categoria que no venga en ellos.';

  return `
Especie: ${ficha.nombre_cientifico}${ficha.familia ? ` (familia ${ficha.familia})` : ''}

Datos oficiales que ha encontrado el sistema:
${JSON.stringify(ficha.oficial, null, 2)}

Escribe, para alguien del sector forestal que no es biologo:
1. Que es esta especie, en dos o tres frases.
2. Donde vive y como se reconoce en campo.
${conservacion}
4. Que deberia tener en cuenta quien se la encuentre trabajando.${alimentacion}
`.trim();
}

export const ESQUEMA_RELATO = {
  type: Type.OBJECT,
  required: [
    'origen_si_no_consta',
    'que_es',
    'donde_vive',
    'como_reconocerla',
    'habitos_alimenticios',
    'importancia_conservacion',
    'en_la_practica',
  ],
  propertyOrdering: [
    'origen_si_no_consta',
    'que_es',
    'donde_vive',
    'como_reconocerla',
    'habitos_alimenticios',
    'importancia_conservacion',
    'en_la_practica',
  ],
  properties: {
    origen_si_no_consta: {
      type: Type.OBJECT,
      required: ['valor', 'explicacion'],
      propertyOrdering: ['valor', 'explicacion'],
      description:
        'Solo se usa cuando el origen oficial figura como "desconocido". En cualquier ' +
        'otro caso pon valor "no_aplica".',
      properties: {
        valor: {
          type: Type.STRING,
          enum: ['nativa', 'exotica', 'desconocido', 'no_aplica'],
        },
        explicacion: {
          type: Type.STRING,
          description: 'Una frase: de donde es originaria y desde cuando esta en Colombia.',
        },
      },
    },
    que_es: { type: Type.STRING },
    donde_vive: { type: Type.STRING },
    como_reconocerla: { type: Type.STRING },
    habitos_alimenticios: {
      type: Type.STRING,
      description:
        'SOLO PARA FAUNA. De que se alimenta, como lo consigue, a que hora del dia come y ' +
        'que papel ecologico cumple al hacerlo (dispersar semillas, polinizar, controlar ' +
        'plagas). En una planta, cadena vacia.',
    },
    importancia_conservacion: { type: Type.STRING },
    en_la_practica: {
      type: Type.STRING,
      description:
        'Que tener en cuenta al encontrarsela trabajando. Sin afirmar nada legal que no ' +
        'venga en los datos oficiales.',
    },
  },
};
