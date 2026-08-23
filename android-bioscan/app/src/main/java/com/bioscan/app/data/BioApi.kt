package com.bioscan.app.data

import com.bioscan.app.BuildConfig
import java.util.concurrent.TimeUnit
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Query

interface BioApi {

    /** Consulta por nombre, comun o cientifico. */
    @GET("api/especie")
    suspend fun consultarNombre(
        @Query("q") consulta: String,
        /** "0" pide solo la ficha oficial, sin gastar cuota de Gemini en el relato. */
        @Query("relato") relato: String,
        @Header("X-App-Key") appKey: String?,
    ): Response<RespuestaEspecie>

    @Multipart
    @POST("api/identificar-especie")
    suspend fun identificarFoto(
        @Part imagen: MultipartBody.Part,
        @Header("X-App-Key") appKey: String?,
    ): Response<RespuestaFoto>

    @GET("health")
    suspend fun salud(): Response<EstadoServidor>
}

object ApiFactory {

    /**
     * Timeouts holgados: la llamada a Gemini ronda los 10-20 s, y el servidor de Render
     * puede tardar casi un minuto en despertar si llevaba rato sin trafico.
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

    private val instancias = mutableMapOf<String, BioApi>()

    /** Reutiliza la instancia por URL: cambiar de servidor en ajustes no obliga a reiniciar. */
    @Synchronized
    fun para(baseUrl: String): BioApi {
        val normalizada = normalizar(baseUrl)
        return instancias.getOrPut(normalizada) {
            Retrofit.Builder()
                .baseUrl(normalizada)
                .client(cliente)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(BioApi::class.java)
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
