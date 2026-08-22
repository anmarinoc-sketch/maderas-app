package com.madera.identificador.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Imagen lista para enviar: los bytes JPEG, una miniatura para pintar en pantalla y la
 * huella con la que el servidor reconoce si esta pieza ya fue verificada.
 */
data class ImagenPreparada(
    val jpeg: ByteArray,
    val vistaPrevia: Bitmap,
    val huella: String,
) {
    val kilobytes: Int get() = jpeg.size / 1024

    // Generados a mano: ByteArray usa identidad en equals/hashCode y el IDE avisa.
    override fun equals(other: Any?): Boolean =
        this === other || (other is ImagenPreparada && jpeg.contentEquals(other.jpeg))

    override fun hashCode(): Int = jpeg.contentHashCode()
}

object Imagenes {

    /** Lado mayor tras el escalado. Suficiente para ver poros y radios sin inflar la subida. */
    private const val LADO_MAX = 1600
    private const val CALIDAD_JPEG = 85

    /**
     * Decodifica, corrige la orientacion EXIF, escala y comprime a JPEG.
     *
     * El escalado se hace en dos pasos (inSampleSize al decodificar y luego escalado fino)
     * para no cargar en memoria una foto de 12 MP: eso revienta con OutOfMemory en gama baja.
     */
    suspend fun preparar(context: Context, uri: Uri): ImagenPreparada = withContext(Dispatchers.IO) {
        // Primera pasada: solo dimensiones. Con inJustDecodeBounds la decodificacion
        // devuelve null siempre, asi que el fallo hay que detectarlo abriendo el stream,
        // no en el resultado de decodeStream.
        val limites = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        val flujo = context.contentResolver.openInputStream(uri)
            ?: throw IllegalArgumentException("No se pudo abrir la imagen seleccionada.")
        flujo.use { BitmapFactory.decodeStream(it, null, limites) }

        if (limites.outWidth <= 0 || limites.outHeight <= 0) {
            throw IllegalArgumentException("El archivo seleccionado no es una imagen válida.")
        }

        val opciones = BitmapFactory.Options().apply {
            inSampleSize = calcularMuestreo(limites.outWidth, limites.outHeight)
        }
        val decodificada = context.contentResolver.openInputStream(uri)
            ?.use { BitmapFactory.decodeStream(it, null, opciones) }
            ?: throw IllegalArgumentException("No se pudo decodificar la imagen.")

        val orientada = corregirOrientacion(context, uri, decodificada)
        val escalada = escalar(orientada)

        val salida = ByteArrayOutputStream()
        escalada.compress(Bitmap.CompressFormat.JPEG, CALIDAD_JPEG, salida)

        ImagenPreparada(
            jpeg = salida.toByteArray(),
            vistaPrevia = escalada,
            huella = huellaDe(escalada),
        )
    }

    /**
     * Vuelve a empaquetar un bitmap ya editado (girado, recortado o ampliado por el
     * usuario) en el mismo formato que se envia al servidor.
     */
    suspend fun desdeBitmap(bitmap: Bitmap): ImagenPreparada = withContext(Dispatchers.IO) {
        val escalada = escalar(bitmap)
        val salida = ByteArrayOutputStream()
        escalada.compress(Bitmap.CompressFormat.JPEG, CALIDAD_JPEG, salida)
        ImagenPreparada(
            jpeg = salida.toByteArray(),
            vistaPrevia = escalada,
            huella = huellaDe(escalada),
        )
    }

    /**
     * Huella perceptual de 64 bits (dHash), en 16 digitos hexadecimales.
     *
     * Reduce la foto a una rejilla de 9x8 en gris y anota, por cada pareja de vecinos de
     * una misma fila, cual sale mas claro. Lo que guarda es el patron de claros y oscuros,
     * no los pixeles: sobrevive a la recompresion, a un recorte leve y a un cambio de luz,
     * que es justo lo que cambia cuando se vuelve a fotografiar la misma tabla.
     *
     * Se calcula aqui, y no en el servidor, porque aqui ya esta el bitmap decodificado;
     * alla habria que anadir una dependencia nativa a un despliegue que funciona.
     */
    fun huellaDe(bitmap: Bitmap): String {
        val ancho = 9
        val alto = 8
        val rejilla = Bitmap.createScaledBitmap(bitmap, ancho, alto, true)
        val pixeles = IntArray(ancho * alto)
        rejilla.getPixels(pixeles, 0, ancho, 0, 0, ancho, alto)
        if (rejilla !== bitmap) rejilla.recycle()

        // Luminancia percibida: el verde pesa mas que el rojo, y el rojo mas que el azul.
        fun gris(pixel: Int): Int {
            val r = (pixel shr 16) and 0xFF
            val g = (pixel shr 8) and 0xFF
            val b = pixel and 0xFF
            return (r * 299 + g * 587 + b * 114) / 1000
        }

        var bits = 0L
        var posicion = 0
        for (y in 0 until alto) {
            for (x in 0 until ancho - 1) {
                val izquierda = gris(pixeles[y * ancho + x])
                val derecha = gris(pixeles[y * ancho + x + 1])
                if (izquierda > derecha) bits = bits or (1L shl posicion)
                posicion += 1
            }
        }

        // toHexString sin relleno se come los ceros de la izquierda y el servidor exige 16.
        // Locale.US fijo: con el idioma del telefono, algunos locales escriben otros digitos.
        return String.format(Locale.US, "%016x", bits)
    }

    /** Archivo temporal en cache/capturas para que la camara del sistema escriba la foto. */
    fun archivoTemporalDeCaptura(context: Context): File {
        val carpeta = File(context.cacheDir, "capturas").apply { mkdirs() }
        // Dejamos solo la ultima captura: no acumulamos fotos en el dispositivo.
        carpeta.listFiles()?.forEach { it.delete() }
        return File(carpeta, "captura_${System.currentTimeMillis()}.jpg")
    }

    private fun calcularMuestreo(ancho: Int, alto: Int): Int {
        var muestreo = 1
        var mayor = maxOf(ancho, alto)
        while (mayor / 2 >= LADO_MAX) {
            mayor /= 2
            muestreo *= 2
        }
        return muestreo
    }

    private fun escalar(origen: Bitmap): Bitmap {
        val mayor = maxOf(origen.width, origen.height)
        if (mayor <= LADO_MAX) return origen

        val factor = LADO_MAX.toFloat() / mayor
        val destino = Bitmap.createScaledBitmap(
            origen,
            (origen.width * factor).toInt().coerceAtLeast(1),
            (origen.height * factor).toInt().coerceAtLeast(1),
            true,
        )
        if (destino !== origen) origen.recycle()
        return destino
    }

    /**
     * Muchas camaras Android guardan la foto en horizontal y anotan la rotacion en EXIF.
     * Si no la aplicamos, el modelo analiza la imagen girada.
     */
    private fun corregirOrientacion(context: Context, uri: Uri, bitmap: Bitmap): Bitmap {
        val orientacion = runCatching {
            context.contentResolver.openInputStream(uri)?.use {
                ExifInterface(it).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            }
        }.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL

        val matriz = Matrix()
        when (orientacion) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matriz.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matriz.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matriz.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matriz.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matriz.postScale(1f, -1f)
            else -> return bitmap
        }

        return runCatching {
            val girada = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matriz, true)
            if (girada !== bitmap) bitmap.recycle()
            girada
        }.getOrDefault(bitmap)
    }
}
