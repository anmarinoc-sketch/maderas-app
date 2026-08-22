package com.madera.identificador.ui

import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.RotateRight
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private val Fondo = Color(0xFF121110)
private val Panel = Color(0xFF1F1D1B)
private val Verde = Color(0xFF8FBF6A)
private val TextoTenue = Color(0xFFB9B2A8)

/**
 * Ajuste de la foto antes de analizarla: girar, ampliar y recortar.
 *
 * Recortar y acercarse importa mas de lo que parece: el servidor reduce la imagen a
 * 1600 px de lado, asi que si la madera ocupa un cuarto del encuadre se pierden tres
 * cuartas partes de la resolucion util. Encuadrar aqui equivale a acercar la camara.
 *
 * El giro se aplica al bitmap en el momento, de modo que el calculo del recorte solo
 * tiene que lidiar con escala y desplazamiento.
 */
@Composable
fun PantallaAjusteFoto(
    original: Bitmap,
    onConfirmar: (Bitmap) -> Unit,
    onRepetir: () -> Unit,
) {
    var base by remember(original) { mutableStateOf(original) }
    var escala by remember(original) { mutableFloatStateOf(1f) }
    var desplazamiento by remember(original) { mutableStateOf(Offset.Zero) }
    var giros by remember(original) { mutableIntStateOf(0) }
    var marco by remember { mutableStateOf(IntSize.Zero) }

    Surface(color = Fondo, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {

            // La X descarta la foto y vuelve al visor: si no gusto como salio, lo natural
            // es cerrarla de inmediato, sin buscar el boton de repetir entre las herramientas.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 8.dp, top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Ajusta la foto", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "Pellizca para acercar y arrastra para mover. Solo se analiza lo que quede dentro del recuadro.",
                        color = TextoTenue,
                        style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
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
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .background(Color.Black)
                        .onSizeChanged { marco = it }
                        .pointerInput(base) {
                            detectTransformGestures { _, paneo, acercamiento, _ ->
                                escala = (escala * acercamiento).coerceIn(1f, 8f)
                                desplazamiento += paneo
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        bitmap = base.asImageBitmap(),
                        contentDescription = "Foto por ajustar",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxSize()
                            .graphicsLayer(
                                scaleX = escala,
                                scaleY = escala,
                                translationX = desplazamiento.x,
                                translationY = desplazamiento.y,
                            ),
                    )

                    // Marco de recorte: deja claro que lo de dentro es lo que se analiza.
                    MarcoDeRecorte(Modifier.fillMaxSize())
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                BotonHerramienta("Girar", Icons.Default.RotateRight) {
                    base = girar(base, 90)
                    giros = (giros + 1) % 4
                    escala = 1f
                    desplazamiento = Offset.Zero
                }
                BotonHerramienta("Reiniciar", Icons.Default.Refresh) {
                    base = original
                    giros = 0
                    escala = 1f
                    desplazamiento = Offset.Zero
                }
                BotonHerramienta("Repetir", Icons.Default.PhotoCamera, onRepetir)
            }

            Text(
                "Zoom ${"%.1f".format(escala)}×",
                color = TextoTenue,
                modifier = Modifier.padding(horizontal = 16.dp),
                style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            )

            Spacer(Modifier.height(8.dp))

            Button(
                onClick = { onConfirmar(recortar(base, marco, escala, desplazamiento)) },
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

@Composable
private fun BotonHerramienta(
    texto: String,
    icono: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .background(Panel, androidx.compose.foundation.shape.RoundedCornerShape(14.dp))
                    .padding(12.dp)
            ) {
                Icon(icono, contentDescription = texto, tint = Color.White)
            }
            Spacer(Modifier.height(4.dp))
            Text(texto, color = TextoTenue, style = androidx.compose.material3.MaterialTheme.typography.labelSmall)
        }
    }
}

/** Esquinas del area de recorte, para que se vea que ese cuadro es lo que se conserva. */
@Composable
private fun MarcoDeRecorte(modifier: Modifier = Modifier) {
    androidx.compose.foundation.Canvas(modifier) {
        val largo = size.minDimension * 0.12f
        val grosor = 5f
        val c = Color.White.copy(alpha = 0.9f)

        fun esquina(x: Float, y: Float, dx: Float, dy: Float) {
            drawLine(c, Offset(x, y), Offset(x + dx, y), grosor, StrokeCap.Round)
            drawLine(c, Offset(x, y), Offset(x, y + dy), grosor, StrokeCap.Round)
        }
        esquina(0f, 0f, largo, largo)
        esquina(size.width, 0f, -largo, largo)
        esquina(0f, size.height, largo, -largo)
        esquina(size.width, size.height, -largo, -largo)
    }
}

private fun girar(origen: Bitmap, grados: Int): Bitmap {
    val matriz = Matrix().apply { postRotate(grados.toFloat()) }
    return runCatching {
        Bitmap.createBitmap(origen, 0, 0, origen.width, origen.height, matriz, true)
    }.getOrDefault(origen)
}

/**
 * Traduce lo que se ve dentro del recuadro a coordenadas del bitmap.
 *
 * La imagen se dibuja con ContentScale.Fit, asi que primero hay que reconstruir esa
 * escala de ajuste y sumarle la que ha aplicado el usuario con los dedos.
 */
private fun recortar(base: Bitmap, marco: IntSize, escala: Float, desplazamiento: Offset): Bitmap {
    if (marco.width <= 0 || marco.height <= 0) return base

    val ajuste = min(marco.width.toFloat() / base.width, marco.height.toFloat() / base.height)
    val efectiva = ajuste * escala
    if (efectiva <= 0f) return base

    // Centro del recuadro trasladado a coordenadas de la imagen.
    val centroX = base.width / 2f - desplazamiento.x / efectiva
    val centroY = base.height / 2f - desplazamiento.y / efectiva

    val anchoVisible = marco.width / efectiva
    val altoVisible = marco.height / efectiva

    var izquierda = (centroX - anchoVisible / 2f).roundToInt()
    var arriba = (centroY - altoVisible / 2f).roundToInt()
    var ancho = anchoVisible.roundToInt()
    var alto = altoVisible.roundToInt()

    // El recorte no puede salirse del bitmap.
    izquierda = izquierda.coerceIn(0, max(0, base.width - 1))
    arriba = arriba.coerceIn(0, max(0, base.height - 1))
    ancho = ancho.coerceIn(1, base.width - izquierda)
    alto = alto.coerceIn(1, base.height - arriba)

    return runCatching { Bitmap.createBitmap(base, izquierda, arriba, ancho, alto) }
        .getOrDefault(base)
}
