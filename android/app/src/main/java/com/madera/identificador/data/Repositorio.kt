package com.madera.identificador.data

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

sealed interface ResultadoLlamada {
    data class Exito(
        val resultado: ResultadoMadera,
        val modelo: String?,
        val latenciaMs: Long?,
    ) : ResultadoLlamada

    data class Fallo(
        val codigo: String,
        val mensaje: String,
        val detalle: String? = null,
    ) : ResultadoLlamada
}

class Repositorio(private val gson: Gson = Gson()) {

    /**
     * Envia la foto al backend. Nunca lanza: cualquier fallo vuelve como [ResultadoLlamada.Fallo]
     * con un codigo estable, de modo que la UI siempre tiene algo que mostrar.
     */
    suspend fun identificar(
        baseUrl: String,
        appKey: String,
        jpeg: ByteArray,
    ): ResultadoLlamada = withContext(Dispatchers.IO) {
        val parte = MultipartBody.Part.createFormData(
            "imagen",
            "corte.jpg",
            jpeg.toRequestBody("image/jpeg".toMediaType()),
        )

        try {
            val respuesta = ApiFactory.para(baseUrl)
                .identificar(parte, appKey.ifBlank { null })

            val cuerpo = respuesta.body()

            if (respuesta.isSuccessful && cuerpo?.resultado != null) {
                return@withContext ResultadoLlamada.Exito(
                    resultado = cuerpo.resultado,
                    modelo = cuerpo.modelo,
                    latenciaMs = cuerpo.latenciaMs,
                )
            }

            // El backend responde el error con la misma forma tanto en 2xx como en 4xx/5xx.
            val error = cuerpo?.error ?: leerError(respuesta.errorBody()?.string())
            ResultadoLlamada.Fallo(
                codigo = error?.codigo ?: "ERROR_${respuesta.code()}",
                mensaje = error?.mensaje ?: "El servidor respondió con el código ${respuesta.code()}.",
                detalle = error?.detalle,
            )
        } catch (e: UnknownHostException) {
            fallaDeRed("No se encontró el servidor.", baseUrl, e)
        } catch (e: ConnectException) {
            fallaDeRed("No se pudo conectar con el servidor.", baseUrl, e)
        } catch (e: SocketTimeoutException) {
            ResultadoLlamada.Fallo(
                codigo = "TIEMPO_AGOTADO",
                mensaje = "El servidor tardó demasiado en responder.",
                detalle = "El análisis suele tardar entre 10 y 20 s. Reinténtalo.",
            )
        } catch (e: SSLException) {
            ResultadoLlamada.Fallo(
                codigo = "ERROR_TLS",
                mensaje = "Fallo en la conexión segura con el servidor.",
                detalle = e.message,
            )
        } catch (e: IOException) {
            fallaDeRed("Se perdió la conexión durante el envío.", baseUrl, e)
        } catch (e: JsonSyntaxException) {
            ResultadoLlamada.Fallo(
                codigo = "RESPUESTA_ILEGIBLE",
                mensaje = "La respuesta del servidor no tiene el formato esperado.",
                detalle = e.message,
            )
        }
    }

    /**
     * Envia al servidor la confirmacion o la correccion del usuario.
     *
     * El servidor acumula estas verificaciones y las inyecta como avisos en las
     * consultas siguientes: es la via para que los errores no se repitan.
     */
    suspend fun verificar(
        baseUrl: String,
        appKey: String,
        verificacion: Verificacion,
    ): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val respuesta = ApiFactory.para(baseUrl).verificar(verificacion, appKey.ifBlank { null })
            val cuerpo = respuesta.body()
            if (respuesta.isSuccessful && cuerpo?.ok == true) {
                cuerpo.registradas ?: 0
            } else {
                error(cuerpo?.error?.mensaje ?: "El servidor respondió ${respuesta.code()}")
            }
        }
    }

    /** Comprueba /health para diagnosticar la URL desde la pantalla de ajustes. */
    suspend fun comprobarServidor(baseUrl: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val respuesta = ApiFactory.para(baseUrl).salud()
            val cuerpo = respuesta.body()
            if (respuesta.isSuccessful && cuerpo?.ok == true) {
                "Servidor operativo · modelo ${cuerpo.modelo ?: "desconocido"}"
            } else {
                error("El servidor respondió ${respuesta.code()}")
            }
        }
    }

    private fun fallaDeRed(mensaje: String, baseUrl: String, e: Exception) = ResultadoLlamada.Fallo(
        codigo = "SIN_CONEXION",
        mensaje = mensaje,
        detalle = "Comprueba tu conexión y que la URL sea correcta: ${ApiFactory.normalizar(baseUrl)}" +
            (e.message?.let { "\n($it)" } ?: ""),
    )

    private fun leerError(json: String?): ErrorApi? = json
        ?.takeIf { it.isNotBlank() }
        ?.let { runCatching { gson.fromJson(it, RespuestaIdentificacion::class.java).error }.getOrNull() }
}
