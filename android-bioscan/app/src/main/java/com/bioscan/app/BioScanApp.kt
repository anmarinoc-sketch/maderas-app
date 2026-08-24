package com.bioscan.app

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import okhttp3.OkHttpClient

/**
 * Aplicación, solo para configurar la carga de imágenes.
 *
 * **Wikimedia rechaza los User-Agent genéricos de librería.** Coil manda el de OkHttp
 * ("okhttp/4.12.0") y upload.wikimedia.org responde **403**, así que la foto salía en
 * gris y sin ningún error visible: parecía que la imagen no existía. Con un agente que
 * identifique la app, la misma URL devuelve 200. Es política suya y está documentada.
 *
 * Comprobado con la URL real de una ficha:
 *   User-Agent: okhttp/4.12.0   -> HTTP 403, 126 bytes
 *   User-Agent: BioScan/1.0 ... -> HTTP 200, 267 KB
 */
class BioScanApp : Application(), ImageLoaderFactory {

    override fun newImageLoader(): ImageLoader {
        val cliente = OkHttpClient.Builder()
            .addInterceptor { cadena ->
                val peticion = cadena.request().newBuilder()
                    .header("User-Agent", AGENTE)
                    .build()
                cadena.proceed(peticion)
            }
            .build()

        return ImageLoader.Builder(this)
            .okHttpClient(cliente)
            // En disco: la misma especie consultada dos veces no vuelve a descargar, y
            // en campo con mala cobertura eso se nota.
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("fotos"))
                    .maxSizeBytes(40L * 1024 * 1024)
                    .build()
            }
            .crossfade(true)
            .build()
    }

    private companion object {
        /** Wikimedia pide que el agente identifique la aplicación y dé un contacto. */
        const val AGENTE =
            "BioScan/1.0 (https://github.com/anmarinoc-sketch/maderas-app) Android"
    }
}
