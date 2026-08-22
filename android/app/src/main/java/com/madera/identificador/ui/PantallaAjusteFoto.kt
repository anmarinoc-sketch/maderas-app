package com.madera.identificador.ui

import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Crop
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RotateRight
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.min
import kotlin.math.roundToInt

private val Fondo = Color(0xFF121110)
private val Panel = Color(0xFF1F1D1B)
private val Verde = Color(0xFF8FBF6A)
private val TextoTenue = Color(0xFFB9B2A8)

/** Lado minimo del recorte, en pixeles de pantalla, para que no se cierre sobre si mismo. */
private const val MINIMO = 80f

/**
 * Ajuste de la foto antes de analizarla: girar y recortar.
 *
 * El recorte es explicito, con un rectangulo que se arrastra por las esquinas, en vez
 * del zoom con dos dedos que habia antes: aquello recortaba de verdad, pero nada en la
 * pantalla lo decia y no habia forma de saber que se estaba conservando.
 *
 * Recortar no es cosmetico. El servidor reduce la imagen a 1600 px de lado, asi que si
 * la madera ocupa un cuarto del encuadre se tiran tres cuartas partes de la resolucion
 * util antes de que el analisis la vea.
 */
@Composable
fun PantallaAjusteFoto(
    original: Bitmap,
    onConfirmar: (Bitmap) -> Unit,
    onRepetir: () -> Unit,
) {
    var base by remember(original) { mutableStateOf(original) }
    var caja by remember { mutableStateOf(IntSize.Zero) }
    var recorte by remember(base, caja) { mutableStateOf<Rect?>(null) }

    // El recorte es un modo, como en las apps de mensajeria: se entra, se ajusta y se
    // confirma o se cancela. Fuera de ese modo la foto se ve limpia, sin marcos encima.
    var modoRecorte by remember(original) { mutableStateOf(false) }

    // Estado del ultimo recorte: sirve para acusar recibo y para poder deshacerlo.
    var recorteAplicado by remember(original) { mutableStateOf(false) }
    var anterior by remember(original) { mutableStateOf<Bitmap?>(null) }

    // Zona que ocupa realmente la imagen dentro del contenedor (ContentScale.Fit deja
    // franjas negras cuando la proporcion no coincide, y ahi no hay nada que recortar).
    val areaImagen = remember(base, caja) { areaDibujada(base, caja) }
    val imagenCompose = remember(base) { base.asImageBitmap() }

    Surface(color = Fondo, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 8.dp, top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Ajusta la foto", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(
                        if (modoRecorte) {
                            "Arrastra las esquinas para dejar dentro solo la madera y pulsa Listo."
                        } else {
                            "Recorta para que el análisis vea la madera de cerca, y gira si hace falta."
                        },
                        color = TextoTenue,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                IconButton(onClick = onRepetir) {
                    Icon(Icons.Default.Close, contentDescription = "Descartar la foto", tint = Color.White)
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(12.dp)
                    .onSizeChanged {
                        if (it != caja) caja = it
                    },
            ) {
                Image(
                    bitmap = imagenCompose,
                    contentDescription = "Foto por recortar",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )

                val marco = recorte ?: areaImagen
                val area = areaImagen
                if (modoRecorte && marco != null && area != null) {
                    VeloYMarco(marco)

                    // Un unico detector para todo el area. Antes habia cinco cajas
                    // superpuestas y una de ellas se redimensionaba en cada fotograma del
                    // arrastre, lo que obligaba a recalcular el layout sin parar.
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .pointerInput(area, base) {
                                var zona = Zona.NINGUNA
                                detectDragGestures(
                                    onDragStart = { punto ->
                                        zona = zonaTocada(punto, recorte ?: area)
                                    },
                                    onDragEnd = { zona = Zona.NINGUNA },
                                    onDragCancel = { zona = Zona.NINGUNA },
                                ) { cambio, arrastre ->
                                    cambio.consume()
                                    val r = recorte ?: area
                                    recorte = when (zona) {
                                        Zona.DENTRO -> r.desplazado(arrastre, area)
                                        Zona.SUP_IZQ ->
                                            r.redimensionado(arrastre.x, arrastre.y, 0f, 0f, area)
                                        Zona.SUP_DER ->
                                            r.redimensionado(0f, arrastre.y, arrastre.x, 0f, area)
                                        Zona.INF_IZQ ->
                                            r.redimensionado(arrastre.x, 0f, 0f, arrastre.y, area)
                                        Zona.INF_DER ->
                                            r.redimensionado(0f, 0f, arrastre.x, arrastre.y, area)
                                        Zona.NINGUNA -> r
                                    }
                                }
                            }
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                if (modoRecorte) {
                    BotonHerramienta("Cancelar", Icons.Default.Close) {
                        recorte = null
                        modoRecorte = false
                    }
                    BotonHerramienta("Girar", Icons.Default.RotateRight) {
                        base = girar(base, 90)
                        recorteAplicado = false
                    }
                    BotonHerramienta("Listo", Icons.Default.Check, destacado = true) {
                        val marco = recorte ?: areaImagen
                        val area = areaImagen
                        if (marco != null && area != null) {
                            val recortada = recortar(base, marco, area)
                            // Solo se acusa el recorte si de verdad cambio algo.
                            if (recortada !== base) {
                                anterior = base
                                base = recortada
                                recorteAplicado = true
                            }
                        }
                        modoRecorte = false
                    }
                } else {
                    BotonHerramienta("Recortar", Icons.Default.Crop, destacado = true) {
                        recorte = null
                        modoRecorte = true
                    }
                    BotonHerramienta("Girar", Icons.Default.RotateRight) {
                        base = girar(base, 90)
                        recorteAplicado = false
                    }
                    BotonHerramienta("Reiniciar", Icons.Default.Refresh) {
                        base = original
                        anterior = null
                        recorteAplicado = false
                    }
                    BotonHerramienta("Repetir", Icons.Default.PhotoCamera, onClick = onRepetir)
                }
            }

            if (recorteAplicado) {
                // Acuse del recorte: sin esto no hay forma de saber si el boton hizo algo.
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .background(Verde.copy(alpha = 0.18f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Verde,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Recorte aplicado",
                            color = Verde,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelLarge,
                        )
                        Text(
                            "Revisa cómo quedó. Puedes recortar otra vez o deshacer.",
                            color = TextoTenue,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                    anterior?.let { previa ->
                        TextButton(onClick = {
                            base = previa
                            anterior = null
                            recorteAplicado = false
                        }) {
                            Text("Deshacer", color = Color.White)
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
            }

            Text(
                "${base.width} × ${base.height} px",
                color = TextoTenue,
                modifier = Modifier.padding(horizontal = 16.dp),
                style = MaterialTheme.typography.labelSmall,
            )

            Spacer(Modifier.height(8.dp))

            // Durante el recorte no se ofrece terminar: primero se confirma el encuadre
            // con Listo, y solo entonces se decide si la foto vale.
            if (!modoRecorte) {
                Button(
                    onClick = { onConfirmar(base) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Verde,
                        contentColor = Color(0xFF14210F),
                    ),
                ) {
                    Icon(Icons.Default.Check, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Usar esta foto", fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

/** Oscurece lo que queda fuera del recorte y dibuja el marco con sus esquinas. */
@Composable
private fun VeloYMarco(marco: Rect) {
    Canvas(Modifier.fillMaxSize()) {
        val velo = Color.Black.copy(alpha = 0.55f)
        drawRect(velo, size = Size(size.width, marco.top))
        drawRect(velo, topLeft = Offset(0f, marco.bottom), size = Size(size.width, size.height - marco.bottom))
        drawRect(velo, topLeft = Offset(0f, marco.top), size = Size(marco.left, marco.height))
        drawRect(
            velo,
            topLeft = Offset(marco.right, marco.top),
            size = Size(size.width - marco.right, marco.height),
        )

        drawRect(
            Color.White.copy(alpha = 0.85f),
            topLeft = Offset(marco.left, marco.top),
            size = Size(marco.width, marco.height),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f),
        )

        val largo = min(marco.width, marco.height) * 0.18f
        fun esquina(x: Float, y: Float, dx: Float, dy: Float) {
            drawLine(Color.White, Offset(x, y), Offset(x + dx, y), 8f, StrokeCap.Round)
            drawLine(Color.White, Offset(x, y), Offset(x, y + dy), 8f, StrokeCap.Round)
        }
        esquina(marco.left, marco.top, largo, largo)
        esquina(marco.right, marco.top, -largo, largo)
        esquina(marco.left, marco.bottom, largo, -largo)
        esquina(marco.right, marco.bottom, -largo, -largo)
    }
}

@Composable
private fun BotonHerramienta(
    texto: String,
    icono: ImageVector,
    destacado: Boolean = false,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .background(
                        if (destacado) Verde.copy(alpha = 0.25f) else Panel,
                        RoundedCornerShape(14.dp),
                    )
                    .padding(12.dp)
            ) {
                Icon(icono, contentDescription = texto, tint = if (destacado) Verde else Color.White)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                texto,
                color = if (destacado) Verde else TextoTenue,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

// --- Geometria -------------------------------------------------------------------

private enum class Zona { NINGUNA, DENTRO, SUP_IZQ, SUP_DER, INF_IZQ, INF_DER }

/** Radio en pixeles alrededor de cada esquina que se considera "tocar la esquina". */
private const val RADIO_ESQUINA = 90f

/** Decide que se esta arrastrando segun donde empezo el dedo. */
private fun zonaTocada(punto: Offset, r: Rect): Zona {
    fun cerca(x: Float, y: Float) =
        kotlin.math.abs(punto.x - x) < RADIO_ESQUINA && kotlin.math.abs(punto.y - y) < RADIO_ESQUINA

    return when {
        cerca(r.left, r.top) -> Zona.SUP_IZQ
        cerca(r.right, r.top) -> Zona.SUP_DER
        cerca(r.left, r.bottom) -> Zona.INF_IZQ
        cerca(r.right, r.bottom) -> Zona.INF_DER
        r.contains(punto) -> Zona.DENTRO
        else -> Zona.NINGUNA
    }
}

/** Rectangulo que ocupa la imagen dentro del contenedor, segun ContentScale.Fit. */
private fun areaDibujada(base: Bitmap, caja: IntSize): Rect? {
    if (caja.width <= 0 || caja.height <= 0 || base.width <= 0 || base.height <= 0) return null
    val ajuste = min(caja.width.toFloat() / base.width, caja.height.toFloat() / base.height)
    val ancho = base.width * ajuste
    val alto = base.height * ajuste
    val izq = (caja.width - ancho) / 2f
    val arr = (caja.height - alto) / 2f
    return Rect(izq, arr, izq + ancho, arr + alto)
}

private fun Rect.desplazado(arrastre: Offset, limite: Rect): Rect {
    val dx = arrastre.x.coerceIn(limite.left - left, limite.right - right)
    val dy = arrastre.y.coerceIn(limite.top - top, limite.bottom - bottom)
    return translate(dx, dy)
}

private fun Rect.redimensionado(dl: Float, dt: Float, dr: Float, db: Float, limite: Rect): Rect {
    val nuevaIzq = (left + dl).coerceIn(limite.left, right - MINIMO)
    val nuevoArr = (top + dt).coerceIn(limite.top, bottom - MINIMO)
    val nuevaDer = (right + dr).coerceIn(nuevaIzq + MINIMO, limite.right)
    val nuevoAba = (bottom + db).coerceIn(nuevoArr + MINIMO, limite.bottom)
    return Rect(nuevaIzq, nuevoArr, nuevaDer, nuevoAba)
}

/** Traduce el rectangulo de pantalla a pixeles del bitmap y recorta. */
private fun recortar(base: Bitmap, marco: Rect, area: Rect): Bitmap {
    if (area.width <= 0f || area.height <= 0f) return base

    val escala = base.width / area.width
    val izq = ((marco.left - area.left) * escala).roundToInt().coerceIn(0, base.width - 1)
    val arr = ((marco.top - area.top) * escala).roundToInt().coerceIn(0, base.height - 1)
    val ancho = (marco.width * escala).roundToInt().coerceIn(1, base.width - izq)
    val alto = (marco.height * escala).roundToInt().coerceIn(1, base.height - arr)

    // Recortar menos de un 2 % no aporta nada y solo degrada la imagen.
    if (ancho >= base.width * 0.98f && alto >= base.height * 0.98f) return base

    return runCatching { Bitmap.createBitmap(base, izq, arr, ancho, alto) }.getOrDefault(base)
}

private fun girar(origen: Bitmap, grados: Int): Bitmap {
    val matriz = Matrix().apply { postRotate(grados.toFloat()) }
    return runCatching {
        Bitmap.createBitmap(origen, 0, 0, origen.width, origen.height, matriz, true)
    }.getOrDefault(origen)
}

