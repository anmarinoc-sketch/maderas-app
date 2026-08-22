package com.madera.identificador.data

import com.google.gson.annotations.SerializedName

/**
 * Espejo del JSON que devuelve el backend.
 *
 * Todos los campos son nullable a proposito: Gson instancia las clases sin pasar por el
 * constructor, asi que los valores por defecto de Kotlin NO se aplican cuando un campo
 * falta en la respuesta. Declararlos no-nulos daria NullPointerException en tiempo de
 * ejecucion ante cualquier respuesta incompleta. La UI resuelve los nulos con `?:` y
 * `orEmpty()`.
 */
data class RespuestaIdentificacion(
    val ok: Boolean? = null,
    @SerializedName("request_id") val requestId: String? = null,
    val modelo: String? = null,
    @SerializedName("latencia_ms") val latenciaMs: Long? = null,
    val resultado: ResultadoMadera? = null,
    val error: ErrorApi? = null,
)

/** Error estructurado del backend. `codigo` es estable y se puede usar en un `when`. */
data class ErrorApi(
    val codigo: String? = null,
    val mensaje: String? = null,
    val detalle: String? = null,
)

data class ResultadoMadera(
    @SerializedName("identificacion_posible") val identificacionPosible: Boolean? = null,
    @SerializedName("calidad_imagen") val calidadImagen: String? = null,
    @SerializedName("caracteristicas_anatomicas") val caracteristicas: Caracteristicas? = null,
    @SerializedName("nombre_comun") val nombreComun: String? = null,
    @SerializedName("nombres_comunes_alternativos") val nombresAlternativos: List<String>? = null,
    @SerializedName("nombre_cientifico") val nombreCientifico: String? = null,
    val familia: String? = null,
    val confianza: Double? = null,
    /** guia_valle_aburra · conocimiento_general · no_identificada */
    @SerializedName("origen_identificacion") val origenIdentificacion: String? = null,
    val alternativas: List<Alternativa>? = null,
    @SerializedName("usos_habituales") val usos: List<String>? = null,
    val limitaciones: List<String>? = null,
    @SerializedName("recomendaciones_captura") val recomendaciones: List<String>? = null,
)

data class Caracteristicas(
    val porosidad: String? = null,
    @SerializedName("vasos_poros") val vasosPoros: String? = null,
    @SerializedName("parenquima_axial") val parenquimaAxial: String? = null,
    val radios: String? = null,
    @SerializedName("anillos_crecimiento") val anillosCrecimiento: String? = null,
    @SerializedName("color_albura_duramen") val colorAlburaDuramen: String? = null,
    @SerializedName("figura_veteado") val figuraVeteado: String? = null,
    @SerializedName("otros_rasgos") val otrosRasgos: List<String>? = null,
) {
    /** Pares (etiqueta, valor) listos para pintar, saltando lo que no vino. */
    fun comoFilas(): List<Pair<String, String>> = listOfNotNull(
        porosidad?.let { "Porosidad" to it },
        vasosPoros?.let { "Vasos y poros" to it },
        parenquimaAxial?.let { "Parénquima axial" to it },
        radios?.let { "Radios" to it },
        anillosCrecimiento?.let { "Anillos de crecimiento" to it },
        colorAlburaDuramen?.let { "Albura y duramen" to it },
        figuraVeteado?.let { "Figura y veteado" to it },
    )
}

data class Alternativa(
    @SerializedName("nombre_comun") val nombreComun: String? = null,
    @SerializedName("nombre_cientifico") val nombreCientifico: String? = null,
    val familia: String? = null,
    val confianza: Double? = null,
    val motivo: String? = null,
)

data class EstadoServidor(
    val ok: Boolean? = null,
    val estado: String? = null,
    val modelo: String? = null,
)
