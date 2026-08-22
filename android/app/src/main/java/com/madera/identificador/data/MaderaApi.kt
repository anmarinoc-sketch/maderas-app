package com.madera.identificador.data

import com.madera.identificador.BuildConfig
import java.util.concurrent.TimeUnit
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface MaderaApi {

    @Multipart
    @POST("api/identificar-madera")
    suspend fun identificar(
        @Part imagen: MultipartBody.Part,
        /** Huella perceptual de la foto: deja que el servidor reconozca una pieza ya verificada. */
        @Part("huella") huella: RequestBody,
        @Header("X-App-Key") appKey: String?,
    ): Response<RespuestaIdentificacion>

    @POST("api/verificacion")
    suspend fun verificar(
        @Body verificacion: Verificacion,
        @Header("X-App-Key") appKey: String?,
    ): Response<RespuestaVerificacion>

    @GET("health")
    suspend fun salud(): Response<EstadoServidor>
}

object ApiFactory {

    /**
     * Timeouts holgados: la llamada a Gemini ronda los 10-15 s, y subir una foto
     * por datos moviles con mala cobertura puede tardar bastante mas.
     */
    private val cliente: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(90, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    // Solo cabeceras y linea de peticion; nunca el cuerpo (son fotos).
                    level = if (BuildConfig.DEBUG) {
                        HttpLoggingInterceptor.Level.BASIC
                    } else {
                        HttpLoggingInterceptor.Level.NONE
                    }
                }
            )
            .build()
    }

    private val instancias = mutableMapOf<String, MaderaApi>()

    /** Reutiliza la instancia por URL: cambiar de servidor en ajustes no obliga a reiniciar. */
    @Synchronized
    fun para(baseUrl: String): MaderaApi {
        val normalizada = normalizar(baseUrl)
        return instancias.getOrPut(normalizada) {
            Retrofit.Builder()
                .baseUrl(normalizada)
                .client(cliente)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(MaderaApi::class.java)
        }
    }

    /** Retrofit exige que la URL base termine en "/" y lleve esquema. */
    fun normalizar(url: String): String {
        var limpia = url.trim()
        if (limpia.isEmpty()) return "http://10.0.2.2:3000/"
        if (!limpia.startsWith("http://") && !limpia.startsWith("https://")) {
            limpia = "https://$limpia"
        }
        if (!limpia.endsWith("/")) limpia = "$limpia/"
        return limpia
    }
}
