package com.bioscan.app.data

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

/** Lo que puede salir de una consulta. Nunca se lanzan excepciones hacia la UI. */
sealed interface Resultado {
    /** Una sola especie resuelta, con su ficha completa. */
    data class Encontrada(
        val ficha: Ficha,
        val resueltoPor: String?,
        val procedencia: Procedencia?,
    ) : Resultado

    /** El nombre designa varias especies: decide el usuario, no la app. */
    data class Elegir(
        val aviso: String?,
        val candidatas: List<Candidata>,
        val notaDelModelo: String?,
    ) : Resultado

    /** Identificacion a partir de una foto. */
    data class PorFoto(
        val identificacion: Identificacion,
        val oficial: Ficha?,
        val alternativas: List<Alternativa>,
        val modelo: String?,
        val latenciaMs: Long?,
        val procedencia: Procedencia?,
    ) : Resultado

    data class NoEncontrada(val aviso: String?) : Resultado

    data class Fallo(
        val codigo: String,
        val mensaje: String,
        val detalle: String? = null,
    ) : Resultado
}

class Repositorio(private val gson: Gson = Gson()) {

    /**
     * Consulta por nombre. Nunca lanza: cualquier fallo vuelve como [Resultado.Fallo] con
     * un codigo estable, para que la pantalla siempre tenga algo que enseñar.
     */
    suspend fun consultarNombre(
        baseUrl: String,
        appKey: String,
        consulta: String,
        conRelato: Boolean,
    ): Resultado = withContext(Dispatchers.IO) {
        envolver(baseUrl) {
            val respuesta = ApiFactory.para(baseUrl).consultarNombre(
                consulta,
                if (conRelato) "1" else "0",
                appKey.ifBlank { null },
            )
            val cuerpo = respuesta.body()

            when {
                !respuesta.isSuccessful || cuerpo?.ok != true -> {
                    val error = cuerpo?.error ?: leerError(respuesta.errorBody()?.string())
                    Resultado.Fallo(
                        codigo = error?.codigo ?: "ERROR_${respuesta.code()}",
                        mensaje = error?.mensaje
                            ?: "El servidor respondió con el código ${respuesta.code()}.",
                        detalle = error?.detalle,
                    )
                }

                cuerpo.hayQueElegir == true -> Resultado.Elegir(
                    aviso = cuerpo.aviso,
                    candidatas = cuerpo.candidatas.orEmpty().filter { it.nombreCientifico != null },
                    notaDelModelo = cuerpo.notaDelModelo,
                )

                cuerpo.ficha != null -> Resultado.Encontrada(
                    ficha = cuerpo.ficha,
                    resueltoPor = cuerpo.resueltoPor,
                    procedencia = cuerpo.procedencia,
                )

                else -> Resultado.NoEncontrada(cuerpo.aviso)
            }
        }
    }

    /** Identifica la especie de una fotografia. */
    suspend fun identificarFoto(
        baseUrl: String,
        appKey: String,
        jpeg: ByteArray,
    ): Resultado = withContext(Dispatchers.IO) {
        val parte = MultipartBody.Part.createFormData(
            "imagen",
            "especie.jpg",
            jpeg.toRequestBody("image/jpeg".toMediaType()),
        )

        envolver(baseUrl) {
            val respuesta = ApiFactory.para(baseUrl).identificarFoto(parte, appKey.ifBlank { null })
            val cuerpo = respuesta.body()

            if (respuesta.isSuccessful && cuerpo?.identificacion != null) {
                Resultado.PorFoto(
                    identificacion = cuerpo.identificacion,
                    oficial = cuerpo.oficial,
                    alternativas = cuerpo.alternativas.orEmpty(),
                    modelo = cuerpo.modelo,
                    latenciaMs = cuerpo.latenciaMs,
                    procedencia = cuerpo.procedencia,
                )
            } else {
                val error = cuerpo?.error ?: leerErrorFoto(respuesta.errorBody()?.string())
                Resultado.Fallo(
                    codigo = error?.codigo ?: "ERROR_${respuesta.code()}",
                    mensaje = error?.mensaje
                        ?: "El servidor respondió con el código ${respuesta.code()}.",
                    detalle = error?.detalle,
                )
            }
        }
    }

    /** Comprueba /health para diagnosticar la URL desde los ajustes. */
    suspend fun comprobarServidor(baseUrl: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val respuesta = ApiFactory.para(baseUrl).salud()
            val cuerpo = respuesta.body()
            if (respuesta.isSuccessful && cuerpo?.ok == true) {
                "Servidor operativo · ${cuerpo.estado ?: "sin estado"}"
            } else {
                error("El servidor respondió ${respuesta.code()}")
            }
        }
    }

    /**
     * Traduce los fallos de red a mensajes que digan algo.
     *
     * Se comparte entre las dos llamadas porque los modos de fallo son los mismos y
     * duplicarlos garantizaba que un dia dijeran cosas distintas ante el mismo problema.
     */
    private inline fun envolver(baseUrl: String, bloque: () -> Resultado): Resultado = try {
        bloque()
    } catch (e: UnknownHostException) {
        fallaDeRed("No se encontró el servidor.", baseUrl, e)
    } catch (e: ConnectException) {
        fallaDeRed("No se pudo conectar con el servidor.", baseUrl, e)
    } catch (e: SocketTimeoutException) {
        Resultado.Fallo(
            codigo = "TIEMPO_AGOTADO",
            mensaje = "El servidor tardó demasiado en responder.",
            detalle = "Si llevaba rato sin usarse, la primera consulta tarda casi un minuto " +
                "en despertarlo. Reinténtalo.",
        )
    } catch (e: SSLException) {
        Resultado.Fallo(
            codigo = "ERROR_TLS",
            mensaje = "Fallo en la conexión segura con el servidor.",
            detalle = e.message,
        )
    } catch (e: IOException) {
        fallaDeRed("Se perdió la conexión durante el envío.", baseUrl, e)
    } catch (e: JsonSyntaxException) {
        Resultado.Fallo(
            codigo = "RESPUESTA_ILEGIBLE",
            mensaje = "La respuesta del servidor no tiene el formato esperado.",
            detalle = e.message,
        )
    }

    private fun fallaDeRed(mensaje: String, baseUrl: String, e: Exception) = Resultado.Fallo(
        codigo = "SIN_CONEXION",
        mensaje = mensaje,
        detalle = "Comprueba tu conexión y que la URL sea correcta: " +
            ApiFactory.normalizar(baseUrl) + (e.message?.let { "\n($it)" } ?: ""),
    )

    private fun leerError(json: String?): ErrorApi? = json
        ?.takeIf { it.isNotBlank() }
        ?.let { runCatching { gson.fromJson(it, RespuestaEspecie::class.java).error }.getOrNull() }

    private fun leerErrorFoto(json: String?): ErrorApi? = json
        ?.takeIf { it.isNotBlank() }
        ?.let { runCatching { gson.fromJson(it, RespuestaFoto::class.java).error }.getOrNull() }
}
