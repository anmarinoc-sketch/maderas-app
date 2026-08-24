package com.bioscan.app.data

import com.google.gson.annotations.SerializedName

/**
 * Espejo de lo que devuelve el backend.
 *
 * TODOS los campos son nullable a proposito. Gson construye estos objetos por reflexion
 * y NO ejecuta los valores por defecto de Kotlin: si el servidor omite un campo, un
 * `String` no nulo se queda en null igualmente y la app revienta al leerlo. Esta trampa
 * ya costo una version rota en XiloScan.
 */

/* ------------------------------------------------------------------------ errores */

data class ErrorApi(
    val codigo: String? = null,
    val mensaje: String? = null,
    val detalle: String? = null,
)

/* ------------------------------------------------------- la ficha de una especie */

/** De donde sale cada mitad de la respuesta. Se enseña en pantalla, no es decorativo. */
data class Procedencia(
    @SerializedName("listas_oficiales") val listasOficiales: String? = null,
    val modelo: String? = null,
)

data class EnListas(
    @SerializedName("catalogo_flora") val catalogoFlora: Boolean? = null,
    @SerializedName("amenazadas_nacional") val amenazadasNacional: Boolean? = null,
    val exoticas: Boolean? = null,
    @SerializedName("fauna_colombia") val faunaColombia: Boolean? = null,
    @SerializedName("aves_endemicas") val avesEndemicas: Boolean? = null,
    val herpetofauna: Boolean? = null,
)

data class Origen(
    /** "nativa", "exotica" o "desconocido". */
    val valor: String? = null,
    val detalle: String? = null,
    /** true si lo dice el modelo porque las listas oficiales no lo tenían. */
    @SerializedName("segun_el_modelo") val segunElModelo: Boolean? = null,
    @SerializedName("origen_geografico") val origenGeografico: String? = null,
    val invasividad: String? = null,
    val fuente: String? = null,
    val nota: String? = null,
)

/** Análisis de riesgo del Humboldt: un pronóstico técnico, no una norma. */
data class PotencialInvasor(
    val riesgo: String? = null,
    val fuente: String? = null,
    val nota: String? = null,
)

/** Lo que la app NO tiene del ICA. Se dice, en vez de callarlo. */
data class NotaIca(
    val estado: String? = null,
    val norma: String? = null,
    val autoridad: String? = null,
    val nota: String? = null,
    val fuente: String? = null,
)

/**
 * Qué se sabe de una exótica como invasora. Tres cosas distintas, y no pesan igual:
 *
 *   `declarada` → la Resolución 0067 de 2023 ya lo decidió. Es un acto administrativo.
 *   `potencial` → el Humboldt dice que podría invadir. Es un pronóstico técnico.
 *   `ica`       → no está cargado, y la app lo dice.
 *
 * Mezclarlas sería darle el mismo peso a un mandato y a una opinión bien fundada.
 */
data class Invasora(
    val declarada: Boolean? = null,
    val norma: String? = null,
    val autoridad: String? = null,
    val modifica: String? = null,
    val efecto: String? = null,
    /** La resolución llama "Eichornia crassipes" al buchón: quien tiene el papel busca eso. */
    @SerializedName("nombre_en_la_norma") val nombreEnLaNorma: String? = null,
    @SerializedName("comun_en_la_norma") val comunEnLaNorma: String? = null,
    val fuente: String? = null,
    val url: String? = null,
    val vigencia: Vigencia? = null,
    val potencial: PotencialInvasor? = null,
    val ica: NotaIca? = null,
)

/** `valor` en null significa "no consta", que NO es lo mismo que "no es endemica". */
data class Endemica(
    val valor: Boolean? = null,
    /** "Endémica" o "Casi endémica". Solo lo trae la lista de aves. */
    val categoria: String? = null,
    /** true en la fauna exótica: no es que no conste, es que la pregunta no viene al caso. */
    @SerializedName("no_aplica") val noAplica: Boolean? = null,
    val fuente: String? = null,
    val donde: String? = null,
    val nota: String? = null,
)

/**
 * Cuándo se comprobó por última vez que la norma sigue en pie.
 *
 * Lo que importa de una veda de 1977 no es su antigüedad, es la antigüedad de la
 * comprobación: sirve igual que una de 2020 si sigue vigente, y no sirve de nada si la
 * derogaron. `aviso` lo calcula el servidor cuando la comprobación caduca, así que una
 * app ya instalada empieza a avisar sola sin reinstalar nada.
 */
data class Vigencia(
    val estado: String? = null,
    val comprobado: String? = null,
    val texto: String? = null,
    val nota: String? = null,
    val aviso: String? = null,
)

/** Una subespecie con su propia categoría, cuando la resolución las separa. */
data class Subcategoria(
    val nombre: String? = null,
    val categoria: String? = null,
)

data class AmenazaNacional(
    val categoria: String? = null,
    val significado: String? = null,
    val norma: String? = null,
    val autoridad: String? = null,
    /**
     * Desglose por subespecie. La resolución a veces categoriza cada una por separado y
     * con categorías distintas: la danta figura como VU, pero la subespecie colombiana
     * está en CR. `categoria` trae la peor del grupo y esto dice de dónde sale.
     */
    val desglose: List<Subcategoria>? = null,
    @SerializedName("nota_desglose") val notaDesglose: String? = null,
    val vigencia: Vigencia? = null,
)

data class AmenazaCatalogo(
    val categoria: String? = null,
    val fuente: String? = null,
)

/** Categoría global de la Lista Roja de la UICN. No siempre coincide con la nacional. */
data class AmenazaGlobal(
    val codigo: String? = null,
    val categoria: String? = null,
    val amenazada: Boolean? = null,
    val fuente: String? = null,
)

data class Amenaza(
    val nacional: AmenazaNacional? = null,
    val global: AmenazaGlobal? = null,
    val catalogo: AmenazaCatalogo? = null,
    @SerializedName("sin_categoria") val sinCategoria: String? = null,
)

data class Cites(
    val apendice: String? = null,
    val significado: String? = null,
    /** "Todo el género Cedrela", cuando la inclusión es de género entero. */
    val alcance: String? = null,
    val desde: String? = null,
    val reunion: String? = null,
    /** Qué productos cubre: trozas, aserrada, chapas… Es lo que decide si te aplica. */
    val anotacion: String? = null,
    val fuente: String? = null,
    val advertencia: String? = null,
    /** Hasta qué reunión de la CITES están revisados los apéndices. */
    val vigencia: Vigencia? = null,
)

data class Distribucion(
    val departamentos: String? = null,
    val altitud: String? = null,
    @SerializedName("regiones_biogeograficas") val regiones: String? = null,
    val global: String? = null,
    val fuente: String? = null,
)

data class Veda(
    val norma: String? = null,
    val autoridad: String? = null,
    val territorio: String? = null,
    val efecto: String? = null,
    val excepciones: String? = null,
    @SerializedName("coincide_por") val coincidePor: List<String>? = null,
    @SerializedName("listado_incompleto") val listadoIncompleto: Boolean? = null,
    val vigencia: Vigencia? = null,
)

/** Estado frente a UNA autoridad. Es la forma en que se hace la pregunta de verdad. */
data class VedaPorAutoridad(
    val autoridad: String? = null,
    val vedada: Boolean? = null,
    val normas: List<String>? = null,
    @SerializedName("listado_completo") val listadoCompleto: Boolean? = null,
    val aviso: String? = null,
)

/**
 * El apartado de veda, ya resuelto por el servidor.
 *
 * `aplica` tiene tres valores y los tres importan:
 *   true  → es flora, la consulta vale y `porAutoridad` dice qué pasa con cada una.
 *   false → es fauna. Las vedas cargadas son de flora y a un animal NO le aplican;
 *           `motivo` lo explica. No se enseña ninguna tabla.
 *   null  → no se pudo saber si es planta o animal, así que la consulta puede no venir
 *           al caso. Se enseña, pero avisando.
 */
data class BloqueVeda(
    val aplica: Boolean? = null,
    val motivo: String? = null,
    /** "Sin veda" no es "sin restricciones" si la especie está amenazada. */
    @SerializedName("nota_amenazada") val notaAmenazada: String? = null,
    @SerializedName("por_autoridad") val porAutoridad: List<VedaPorAutoridad>? = null,
    val detalle: List<Veda>? = null,
)

/** Fotografía de la especie, sacada de Wikipedia por su nombre científico. */
data class Foto(
    val url: String? = null,
    val fuente: String? = null,
)

data class Relato(
    @SerializedName("que_es") val queEs: String? = null,
    @SerializedName("donde_vive") val dondeVive: String? = null,
    @SerializedName("como_reconocerla") val comoReconocerla: String? = null,
    /** Solo en fauna: de qué come y qué papel cumple al hacerlo. En flora viene vacío. */
    @SerializedName("habitos_alimenticios") val habitosAlimenticios: String? = null,
    @SerializedName("importancia_conservacion") val importanciaConservacion: String? = null,
    @SerializedName("en_la_practica") val enLaPractica: String? = null,
    @SerializedName("generado_por") val generadoPor: String? = null,
    /**
     * Las normas y fuentes en las que se apoya el texto.
     *
     * Las escribe el SERVIDOR, no el modelo: el modelo solo elige de una lista cerrada de
     * siete palabras en qué bloque se apoyó, y el servidor traduce cada una al nombre real
     * de lo que le mandó. A un modelo al que se le pide que cite le salen números de
     * resolución plausibles y falsos.
     */
    val referencias: List<String>? = null,
    /** Lo que el modelo dice haber escrito de su propio conocimiento, sin lista detrás. */
    @SerializedName("sin_respaldo") val sinRespaldo: String? = null,
)

/** Todo lo que las listas oficiales saben de una especie, mas el relato del modelo. */
data class Ficha(
    @SerializedName("nombre_cientifico") val nombreCientifico: String? = null,
    val autoria: String? = null,
    val familia: String? = null,
    val reino: String? = null,
    val clase: String? = null,
    @SerializedName("nombres_comunes") val nombresComunes: String? = null,
    @SerializedName("en_listas") val enListas: EnListas? = null,
    @SerializedName("es_fauna") val esFauna: Boolean? = null,
    /**
     * Especie que no es de aquí, flora o fauna. De ella solo se dice eso: ni endemismo ni
     * categoría de amenaza, porque no le aplican. Sí se siguen enseñando CITES, el
     * potencial invasor y, en flora, la veda: alcanza por familia y una orquídea traída
     * de fuera cae dentro igual.
     */
    @SerializedName("es_exotica") val esExotica: Boolean? = null,
    /** Forma antigua, la que entiende bio-v7. `esExotica` la sustituye. */
    @SerializedName("fauna_exotica") val faunaExotica: Boolean? = null,
    val origen: Origen? = null,
    val invasora: Invasora? = null,
    val endemica: Endemica? = null,
    val amenaza: Amenaza? = null,
    val cites: Cites? = null,
    val distribucion: Distribucion? = null,
    /** Forma antigua. Se conserva por si el servidor no manda todavía `veda`. */
    val vedas: List<Veda>? = null,
    val veda: BloqueVeda? = null,
    val foto: Foto? = null,
    val fuentes: List<String>? = null,
    val relato: Relato? = null,
    @SerializedName("relato_no_disponible") val relatoNoDisponible: String? = null,
)

/* ------------------------------------------------------- consulta por nombre */

data class Candidata(
    @SerializedName("nombre_cientifico") val nombreCientifico: String? = null,
    val familia: String? = null,
    @SerializedName("nombres_comunes") val nombresComunes: String? = null,
    @SerializedName("nombre_comun") val nombreComun: String? = null,
    @SerializedName("donde_se_usa") val dondeSeUsa: String? = null,
    val origen: String? = null,
    val endemica: Boolean? = null,
    val amenaza: String? = null,
    val vedada: Boolean? = null,
    /** Solo cuando la lista sale de un parecido: con qué nombre se pareció lo tecleado. */
    @SerializedName("se_parece_a") val parecidoA: String? = null,
    @SerializedName("parecido_por") val parecidoPor: String? = null,
)

data class RespuestaEspecie(
    val ok: Boolean? = null,
    val consulta: String? = null,
    val procedencia: Procedencia? = null,
    @SerializedName("resuelto_por") val resueltoPor: String? = null,
    val ficha: Ficha? = null,
    @SerializedName("hay_que_elegir") val hayQueElegir: Boolean? = null,
    val aviso: String? = null,
    val candidatas: List<Candidata>? = null,
    @SerializedName("nota_del_modelo") val notaDelModelo: String? = null,
    val encontrada: Boolean? = null,
    val modelo: String? = null,
    val error: ErrorApi? = null,
)

/* ------------------------------------------------------ identificacion por foto */

data class Alternativa(
    @SerializedName("nombre_comun") val nombreComun: String? = null,
    @SerializedName("nombre_cientifico") val nombreCientifico: String? = null,
    val familia: String? = null,
    val confianza: Double? = null,
    val motivo: String? = null,
    val oficial: Ficha? = null,
)

data class Identificacion(
    @SerializedName("es_ser_vivo") val esSerVivo: Boolean? = null,
    @SerializedName("calidad_imagen") val calidadImagen: String? = null,
    val grupo: String? = null,
    @SerializedName("tipo_de_organismo") val tipoDeOrganismo: String? = null,
    @SerializedName("caracteres_observados") val caracteresObservados: List<String>? = null,
    @SerializedName("nombre_comun") val nombreComun: String? = null,
    @SerializedName("nombres_comunes_alternativos") val nombresComunesAlternativos: List<String>? = null,
    @SerializedName("nombre_cientifico") val nombreCientifico: String? = null,
    val familia: String? = null,
    val confianza: Double? = null,
    @SerializedName("nivel_alcanzado") val nivelAlcanzado: String? = null,
    val alternativas: List<Alternativa>? = null,
    val habitat: String? = null,
    @SerializedName("historia_natural") val historiaNatural: String? = null,
    @SerializedName("importancia_ecologica") val importanciaEcologica: String? = null,
    val limitaciones: List<String>? = null,
    @SerializedName("recomendaciones_captura") val recomendacionesCaptura: List<String>? = null,
)

data class RespuestaFoto(
    val ok: Boolean? = null,
    val modelo: String? = null,
    @SerializedName("latencia_ms") val latenciaMs: Long? = null,
    val procedencia: Procedencia? = null,
    val identificacion: Identificacion? = null,
    val oficial: Ficha? = null,
    val alternativas: List<Alternativa>? = null,
    val error: ErrorApi? = null,
)

/* ----------------------------------------------------------------- diagnostico */

data class EstadoServidor(
    val ok: Boolean? = null,
    val estado: String? = null,
    val modelo: String? = null,
)
