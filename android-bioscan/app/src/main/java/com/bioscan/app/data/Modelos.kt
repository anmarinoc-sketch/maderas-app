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
)

data class Origen(
    /** "nativa", "exotica" o "desconocido". */
    val valor: String? = null,
    val detalle: String? = null,
    @SerializedName("origen_geografico") val origenGeografico: String? = null,
    val invasividad: String? = null,
    val fuente: String? = null,
    val nota: String? = null,
)

/** `valor` en null significa "no consta", que NO es lo mismo que "no es endemica". */
data class Endemica(
    val valor: Boolean? = null,
    val fuente: String? = null,
    val nota: String? = null,
)

data class AmenazaNacional(
    val categoria: String? = null,
    val significado: String? = null,
    val norma: String? = null,
    val autoridad: String? = null,
)

data class AmenazaCatalogo(
    val categoria: String? = null,
    val fuente: String? = null,
)

data class Amenaza(
    val nacional: AmenazaNacional? = null,
    val catalogo: AmenazaCatalogo? = null,
    @SerializedName("sin_categoria") val sinCategoria: String? = null,
)

data class Cites(
    val apendice: String? = null,
    val significado: String? = null,
    val fuente: String? = null,
    val advertencia: String? = null,
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
    val ambito: String? = null,
    val territorio: String? = null,
    val efecto: String? = null,
    val excepciones: String? = null,
    @SerializedName("coincide_por") val coincidePor: List<String>? = null,
    @SerializedName("nombre_en_la_norma") val nombreEnLaNorma: String? = null,
    @SerializedName("listado_incompleto") val listadoIncompleto: Boolean? = null,
)

data class CoberturaVedas(
    val completa: Boolean? = null,
    @SerializedName("listados_incompletos") val listadosIncompletos: List<String>? = null,
    val advertencia: String? = null,
    @SerializedName("nota_procedimiento") val notaProcedimiento: String? = null,
)

data class Relato(
    @SerializedName("que_es") val queEs: String? = null,
    @SerializedName("donde_vive") val dondeVive: String? = null,
    @SerializedName("como_reconocerla") val comoReconocerla: String? = null,
    @SerializedName("importancia_conservacion") val importanciaConservacion: String? = null,
    @SerializedName("en_la_practica") val enLaPractica: String? = null,
    @SerializedName("generado_por") val generadoPor: String? = null,
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
    val origen: Origen? = null,
    val endemica: Endemica? = null,
    val amenaza: Amenaza? = null,
    val cites: Cites? = null,
    val distribucion: Distribucion? = null,
    val vedas: List<Veda>? = null,
    @SerializedName("cobertura_vedas") val coberturaVedas: CoberturaVedas? = null,
    val fuentes: List<String>? = null,
    val relato: Relato? = null,
    @SerializedName("relato_no_disponible") val relatoNoDisponible: String? = null,
) {
    /** Si no aparecio en ninguna lista, lo unico que hay es lo que diga el modelo. */
    val estaEnAlgunaLista: Boolean
        get() = enListas?.catalogoFlora == true ||
            enListas?.amenazadasNacional == true ||
            enListas?.exoticas == true
}

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
