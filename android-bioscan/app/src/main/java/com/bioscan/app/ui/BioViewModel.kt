package com.bioscan.app.ui

import android.app.Application
import android.graphics.Bitmap
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bioscan.app.data.Alternativa
import com.bioscan.app.data.Candidata
import com.bioscan.app.data.Ficha
import com.bioscan.app.data.Identificacion
import com.bioscan.app.data.Procedencia
import com.bioscan.app.data.Repositorio
import com.bioscan.app.data.Resultado
import com.bioscan.app.util.Ajustes
import com.bioscan.app.util.Imagenes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** En que punto esta la pantalla. */
sealed interface Estado {
    data object Reposo : Estado

    data class Trabajando(val mensaje: String) : Estado

    data class FichaLista(
        val ficha: Ficha,
        val resueltoPor: String?,
        val procedencia: Procedencia?,
    ) : Estado

    data class HayQueElegir(
        val aviso: String?,
        val candidatas: List<Candidata>,
        val notaDelModelo: String?,
    ) : Estado

    data class Identificada(
        val identificacion: Identificacion,
        val oficial: Ficha?,
        val alternativas: List<Alternativa>,
        val modelo: String?,
        val latenciaMs: Long?,
        val procedencia: Procedencia?,
        val vistaPrevia: Bitmap?,
    ) : Estado

    data class Vacio(val aviso: String?) : Estado

    data class Fallo(val codigo: String, val mensaje: String, val detalle: String?) : Estado
}

class BioViewModel(app: Application) : AndroidViewModel(app) {

    private val repositorio = Repositorio()
    private val ajustes = Ajustes(app)

    private val _estado = MutableStateFlow<Estado>(Estado.Reposo)
    val estado: StateFlow<Estado> = _estado.asStateFlow()

    private val _consulta = MutableStateFlow("")
    val consulta: StateFlow<String> = _consulta.asStateFlow()

    /** Se conserva para poder volver atras desde una ficha a la lista de candidatas. */
    private var ultimaEleccion: Estado.HayQueElegir? = null

    // Accesores explicitos en vez de delegar con `by ajustes::campo`: la delegacion es
    // valida, pero aqui no hay forma de compilar en local y no compensa arriesgar una
    // vuelta entera de CI por ahorrar cuatro lineas.
    var urlServidor: String
        get() = ajustes.urlServidor
        set(valor) { ajustes.urlServidor = valor }

    var claveApp: String
        get() = ajustes.claveApp
        set(valor) { ajustes.claveApp = valor }

    var pedirRelato: Boolean
        get() = ajustes.pedirRelato
        set(valor) { ajustes.pedirRelato = valor }

    var bienvenidaVista: Boolean
        get() = ajustes.bienvenidaVista
        set(valor) { ajustes.bienvenidaVista = valor }

    fun alEscribir(texto: String) {
        _consulta.value = texto
    }

    fun volverAlInicio() {
        _estado.value = Estado.Reposo
        ultimaEleccion = null
    }

    /** Vuelve a la lista de candidatas sin repetir la consulta. */
    fun volverALasCandidatas() {
        ultimaEleccion?.let { _estado.value = it } ?: volverAlInicio()
    }

    val puedeVolverALasCandidatas: Boolean get() = ultimaEleccion != null

    /* -------------------------------------------------------------- por nombre */

    fun consultarPorNombre(texto: String = _consulta.value) {
        val limpio = texto.trim()
        if (limpio.length < 2) return

        _consulta.value = limpio
        ultimaEleccion = null
        buscar(limpio, "Consultando las listas oficiales...")
    }

    /** El usuario ha elegido una de las candidatas: se consulta ya por su nombre cientifico. */
    fun elegirCandidata(candidata: Candidata) {
        val nombre = candidata.nombreCientifico ?: return
        // Se guarda la lista para que el boton de volver no obligue a repetir la busqueda.
        ultimaEleccion = _estado.value as? Estado.HayQueElegir ?: ultimaEleccion
        buscar(nombre, "Consultando ${nombre}...")
    }

    /** Consulta la ficha de una alternativa propuesta a partir de una foto. */
    fun consultarNombreCientifico(nombre: String) {
        ultimaEleccion = null
        _consulta.value = nombre
        buscar(nombre, "Consultando ${nombre}...")
    }

    private fun buscar(texto: String, mensaje: String) {
        _estado.value = Estado.Trabajando(mensaje)
        viewModelScope.launch {
            val resultado = repositorio.consultarNombre(
                baseUrl = urlServidor,
                appKey = claveApp,
                consulta = texto,
                conRelato = pedirRelato,
            )
            _estado.value = aEstado(resultado, null)
        }
    }

    /* ----------------------------------------------------------------- por foto */

    fun identificarFoto(uri: Uri) {
        _estado.value = Estado.Trabajando("Preparando la fotografía...")
        ultimaEleccion = null

        viewModelScope.launch {
            val preparada = runCatching { Imagenes.preparar(getApplication(), uri) }.getOrElse { e ->
                _estado.value = Estado.Fallo(
                    codigo = "IMAGEN_INVALIDA",
                    mensaje = e.message ?: "No se pudo leer la fotografía.",
                    detalle = "Prueba con otra imagen o vuelve a tomarla.",
                )
                return@launch
            }

            _estado.value = Estado.Trabajando(
                "Identificando (${preparada.kilobytes} KB)... puede tardar unos segundos."
            )

            val resultado = repositorio.identificarFoto(
                baseUrl = urlServidor,
                appKey = claveApp,
                jpeg = preparada.jpeg,
            )
            _estado.value = aEstado(resultado, preparada.vistaPrevia)
        }
    }

    private fun aEstado(resultado: Resultado, vistaPrevia: Bitmap?): Estado = when (resultado) {
        is Resultado.Encontrada ->
            Estado.FichaLista(resultado.ficha, resultado.resueltoPor, resultado.procedencia)

        is Resultado.Elegir ->
            Estado.HayQueElegir(resultado.aviso, resultado.candidatas, resultado.notaDelModelo)

        is Resultado.PorFoto -> Estado.Identificada(
            identificacion = resultado.identificacion,
            oficial = resultado.oficial,
            alternativas = resultado.alternativas,
            modelo = resultado.modelo,
            latenciaMs = resultado.latenciaMs,
            procedencia = resultado.procedencia,
            vistaPrevia = vistaPrevia,
        )

        is Resultado.NoEncontrada -> Estado.Vacio(resultado.aviso)

        is Resultado.Fallo -> Estado.Fallo(resultado.codigo, resultado.mensaje, resultado.detalle)
    }

    /* --------------------------------------------------------------- diagnostico */

    private val _diagnostico = MutableStateFlow<String?>(null)
    val diagnostico: StateFlow<String?> = _diagnostico.asStateFlow()

    fun comprobarServidor() {
        _diagnostico.value = "Comprobando..."
        viewModelScope.launch {
            _diagnostico.value = repositorio.comprobarServidor(urlServidor)
                .fold({ it }, { "No responde: ${it.message}" })
        }
    }

    fun limpiarDiagnostico() {
        _diagnostico.value = null
    }
}
