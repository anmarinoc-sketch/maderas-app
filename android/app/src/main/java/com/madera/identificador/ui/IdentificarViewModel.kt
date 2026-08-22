package com.madera.identificador.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.madera.identificador.data.Repositorio
import com.madera.identificador.data.ResultadoLlamada
import com.madera.identificador.data.ResultadoMadera
import com.madera.identificador.util.Ajustes
import com.madera.identificador.util.ImagenPreparada
import com.madera.identificador.util.Imagenes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface EstadoAnalisis {
    data object Inicial : EstadoAnalisis
    data object Cargando : EstadoAnalisis

    data class Exito(
        val resultado: ResultadoMadera,
        val modelo: String?,
        val latenciaMs: Long?,
    ) : EstadoAnalisis

    data class Error(
        val codigo: String,
        val mensaje: String,
        val detalle: String?,
    ) : EstadoAnalisis
}

data class EstadoUi(
    val imagen: ImagenPreparada? = null,
    /** La foto recien tomada pasa primero por el editor: girar, ampliar y recortar. */
    val ajustada: Boolean = false,
    val original: ImagenPreparada? = null,
    val analisis: EstadoAnalisis = EstadoAnalisis.Inicial,
    val urlServidor: String = "",
    val claveApp: String = "",
    val comprobandoServidor: Boolean = false,
    val mensajeServidor: String? = null,
)

class IdentificarViewModel(application: Application) : AndroidViewModel(application) {

    private val ajustes = Ajustes(application)
    private val repositorio = Repositorio()

    private val _estado = MutableStateFlow(
        EstadoUi(urlServidor = ajustes.urlServidor, claveApp = ajustes.claveApp)
    )
    val estado: StateFlow<EstadoUi> = _estado.asStateFlow()

    /** Carga y comprime la foto elegida; el analisis lo dispara el usuario aparte. */
    fun seleccionarImagen(uri: Uri) {
        viewModelScope.launch {
            runCatching { Imagenes.preparar(getApplication(), uri) }
                .onSuccess { imagen ->
                    _estado.update {
                        it.copy(
                            imagen = imagen,
                            original = imagen,
                            ajustada = false,
                            analisis = EstadoAnalisis.Inicial,
                        )
                    }
                }
                .onFailure { e ->
                    _estado.update {
                        it.copy(
                            analisis = EstadoAnalisis.Error(
                                codigo = "IMAGEN_ILEGIBLE",
                                mensaje = e.message ?: "No se pudo procesar la imagen.",
                                detalle = null,
                            )
                        )
                    }
                }
        }
    }

    fun identificar() {
        val imagen = _estado.value.imagen ?: return
        if (_estado.value.analisis is EstadoAnalisis.Cargando) return

        viewModelScope.launch {
            _estado.update { it.copy(analisis = EstadoAnalisis.Cargando) }

            val respuesta = repositorio.identificar(
                baseUrl = ajustes.urlServidor,
                appKey = ajustes.claveApp,
                jpeg = imagen.jpeg,
            )

            _estado.update {
                it.copy(
                    analisis = when (respuesta) {
                        is ResultadoLlamada.Exito -> EstadoAnalisis.Exito(
                            resultado = respuesta.resultado,
                            modelo = respuesta.modelo,
                            latenciaMs = respuesta.latenciaMs,
                        )

                        is ResultadoLlamada.Fallo -> EstadoAnalisis.Error(
                            codigo = respuesta.codigo,
                            mensaje = respuesta.mensaje,
                            detalle = respuesta.detalle,
                        )
                    }
                )
            }
        }
    }

    /** Confirma el recorte y giro hechos por el usuario. */
    fun confirmarAjuste(bitmap: android.graphics.Bitmap) {
        viewModelScope.launch {
            runCatching { Imagenes.desdeBitmap(bitmap) }
                .onSuccess { imagen ->
                    _estado.update { it.copy(imagen = imagen, ajustada = true) }
                }
                .onFailure { e ->
                    _estado.update {
                        it.copy(
                            analisis = EstadoAnalisis.Error(
                                codigo = "RECORTE_FALLIDO",
                                mensaje = e.message ?: "No se pudo aplicar el recorte.",
                                detalle = null,
                            )
                        )
                    }
                }
        }
    }

    /** Vuelve al editor partiendo siempre de la foto original, no de un recorte previo. */
    fun volverAAjustar() {
        _estado.update { it.copy(imagen = it.original ?: it.imagen, ajustada = false) }
    }

    fun limpiar() {
        _estado.update {
            it.copy(imagen = null, original = null, ajustada = false, analisis = EstadoAnalisis.Inicial)
        }
    }

    fun guardarAjustes(url: String, clave: String) {
        ajustes.urlServidor = url
        ajustes.claveApp = clave
        _estado.update {
            it.copy(
                urlServidor = ajustes.urlServidor,
                claveApp = ajustes.claveApp,
                mensajeServidor = null,
            )
        }
    }

    /** Diagnostico rapido de la URL: golpea /health y cuenta lo que pasa. */
    fun probarServidor(url: String) {
        viewModelScope.launch {
            _estado.update { it.copy(comprobandoServidor = true, mensajeServidor = null) }
            val resultado = repositorio.comprobarServidor(url)
            _estado.update {
                it.copy(
                    comprobandoServidor = false,
                    mensajeServidor = resultado.fold(
                        onSuccess = { texto -> texto },
                        onFailure = { e -> "No responde: ${e.message ?: "error desconocido"}" },
                    ),
                )
            }
        }
    }
}
