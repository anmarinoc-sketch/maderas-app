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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
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
import androidx.compose.ui.unit.IntOffset
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
    val densidad = androidx.compose.ui.platform.LocalDensity.current
    var recorte by remember(base, caja) { mutableStateOf<Rect?>(null) }

    // Zona que ocupa realmente la imagen dentro del contenedor (ContentScale.Fit deja
    // franjas negras cuando la proporcion no coincide, y ahi no hay nada que recortar).
    val areaImagen = remember(base, caja) { areaDibujada(base, caja) }

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
                        "Arrastra las esquinas para dejar dentro solo la madera y pulsa Recortar.",
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
                    bitmap = base.asImageBitmap(),
                    contentDescription = "Foto por recortar",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )

                val marco = recorte ?: areaImagen
                val area = areaImagen
                if (marco != null && area != null) {
                    VeloYMarco(marco)

                    // Arrastrar por dentro mueve el recorte entero.
                    Box(
                        modifier = Modifier
                            .offset { IntOffset(marco.left.roundToInt(), marco.top.roundToInt()) }
                            .size(
                                with(densidad) { marco.width.toDp() },
                                with(densidad) { marco.height.toDp() },
                            )
                            .pointerInput(area, base) {
                                detectDragGestures { cambio, arrastre ->
                                    cambio.consume()
                                    recorte = marco.desplazado(arrastre, area)
                                }
                            }
                    )

                    Tirador(marco.left, marco.top, area, base) { dx, dy ->
                        recorte = marco.redimensionado(dx, dy, 0f, 0f, area)
                    }
                    Tirador(marco.right, marco.top, area, base) { dx, dy ->
                        recorte = marco.redimensionado(0f, dy, dx, 0f, area)
                    }
                    Tirador(marco.left, marco.bottom, area, base) { dx, dy ->
                        recorte = marco.redimensionado(dx, 0f, 0f, dy, area)
                    }
                    Tirador(marco.right, marco.bottom, area, base) { dx, dy ->
                        recorte = marco.redimensionado(0f, 0f, dx, dy, area)
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                BotonHerramienta("Recortar", Icons.Default.Crop, destacado = true) {
                    val marco = recorte ?: areaImagen
                    val area = areaImagen
                    if (marco != null && area != null) {
                        base = recortar(base, marco, area)
                    }
                }
                BotonHerramienta("Girar", Icons.Default.RotateRight) {
                    base = girar(base, 90)
                }
                BotonHerramienta("Reiniciar", Icons.Default.Refresh) {
                    base = original
                }
                BotonHerramienta("Repetir", Icons.Default.PhotoCamera, onClick = onRepetir)
            }

            Text(
                "${base.width} × ${base.height} px",
                color = TextoTenue,
                modifier = Modifier.padding(horizontal = 16.dp),
                style = MaterialTheme.typography.labelSmall,
            )

            Spacer(Modifier.height(8.dp))

            Button(
                onClick = {
                    // Si quedo recorte sin aplicar, se aplica ahora: nadie deberia perder
                    // el encuadre que acaba de hacer por no haber pulsado Recortar.
                    val marco = recorte ?: areaImagen
                    val area = areaImagen
                    val salida = if (marco != null && area != null) recortar(base, marco, area) else base
                    onConfirmar(salida)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Verde, contentColor = Color(0xFF14210F)),
            ) {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Usar esta foto", fontWeight = FontWeight.Bold)
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

/** Zona sensible en una esquina del recorte. Es mayor que la marca para poder cogerla. */
@Composable
private fun Tirador(
    x: Float,
    y: Float,
    area: Rect,
    base: Bitmap,
    onArrastre: (Float, Float) -> Unit,
) {
    val lado = 48
    Box(
        modifier = Modifier
            .offset { IntOffset((x - lado / 2).roundToInt(), (y - lado / 2).roundToInt()) }
            .size(lado.dp)
            .pointerInput(area, base) {
                detectDragGestures { cambio, arrastre ->
                    cambio.consume()
                    onArrastre(arrastre.x, arrastre.y)
                }
            }
    )
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

