package com.madera.identificador.ui

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.madera.identificador.util.Imagenes
import java.util.concurrent.Executors

/** Colores propios de la pantalla de captura: un visor de camara pide fondo oscuro. */
private val Fondo = Color(0xFF121110)
private val Panel = Color(0xFF1F1D1B)
private val Verde = Color(0xFF8FBF6A)
private val TextoTenue = Color(0xFFB9B2A8)

/**
 * Pantalla inicial: visor de camara con guias de encuadre, aviso de luz y linterna.
 *
 * Se usa CameraX en lugar de la app de camara del sistema porque el encuadre y la
 * iluminacion son justo lo que decide si la foto sirve para identificar: aqui podemos
 * dibujar el marco, medir la luz en vivo y encender el flash como luz continua.
 */
@Composable
fun PantallaCaptura(
    onFoto: (Uri) -> Unit,
    onError: (String) -> Unit,
    onAjustes: () -> Unit,
    onVerExplicacion: () -> Unit = {},
    mensaje: String? = null,
) {
    val context = LocalContext.current
    val dueño = LocalLifecycleOwner.current

    var permisoConcedido by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var permisoRechazado by remember { mutableStateOf(false) }
    var mostrarAyuda by remember { mutableStateOf(false) }
    var linterna by remember { mutableStateOf(false) }
    var luminancia by remember { mutableDoubleStateOf(-1.0) }
    var camara by remember { mutableStateOf<Camera?>(null) }
    var zoom by remember { mutableFloatStateOf(1f) }
    // Cada movil tiene su tope; si la camara aun no esta lista se asume 1 (sin zoom).
    val zoomMaximo = camara?.cameraInfo?.zoomState?.value?.maxZoomRatio ?: 1f

    val capturador = remember {
        ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
            .build()
    }
    val hiloAnalisis = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) { onDispose { hiloAnalisis.shutdown() } }

    val pedirPermiso = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { concedido ->
        permisoConcedido = concedido
        permisoRechazado = !concedido
    }

    // Respaldo cuando no hay permiso de camara: la app de camara del sistema no lo exige.
    var uriSistema by remember { mutableStateOf<Uri?>(null) }
    val camaraSistema = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) uriSistema?.let(onFoto)
    }

    val galeria = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(onFoto)
    }

    DisposableEffect(permisoConcedido) {
        if (!permisoConcedido && !permisoRechazado) pedirPermiso.launch(Manifest.permission.CAMERA)
        onDispose { }
    }

    // Encender o apagar la linterna cuando cambia el interruptor.
    DisposableEffect(linterna, camara) {
        camara?.cameraControl?.enableTorch(linterna)
        onDispose { }
    }

    Surface(color = Fondo, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {

            BarraSuperior(onAyuda = { mostrarAyuda = true }, onAjustes = onAjustes)

            if (mensaje != null) {
                Aviso(titulo = "No se pudo usar esa imagen", detalle = mensaje, alerta = true)
            } else {
                Aviso(
                    titulo = "Fotografía la cara del corte",
                    detalle = "La punta de la pieza, la que atraviesa la veta. No la cara larga.",
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                if (permisoConcedido) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            val vista = PreviewView(ctx).apply {
                                scaleType = PreviewView.ScaleType.FILL_CENTER
                            }
                            val futuro = ProcessCameraProvider.getInstance(ctx)
                            futuro.addListener({
                                runCatching {
                                    val proveedor = futuro.get()
                                    val previa = Preview.Builder().build().also {
                                        it.setSurfaceProvider(vista.surfaceProvider)
                                    }
                                    val analisis = ImageAnalysis.Builder()
                                        .setBackpressureStrategy(
                                            ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST
                                        )
                                        .build()
                                        .also { a ->
                                            a.setAnalyzer(hiloAnalisis) { imagen ->
                                                luminancia = mediaDeLuz(imagen)
                                                imagen.close()
                                            }
                                        }
                                    proveedor.unbindAll()
                                    camara = proveedor.bindToLifecycle(
                                        dueño,
                                        CameraSelector.DEFAULT_BACK_CAMERA,
                                        previa,
                                        analisis,
                                        capturador,
                                    )
                                }.onFailure {
                                    onError("No se pudo abrir la cámara: ${it.message}")
                                }
                            }, ContextCompat.getMainExecutor(ctx))
                            vista
                        },
                    )

                    // Capa de gestos sobre la vista previa: pellizcar mueve el zoom REAL
                    // de la camara, no un recorte digital posterior. Acercarse con la
                    // optica conserva detalle; recortar despues lo pierde.
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .pointerInput(camara, zoomMaximo) {
                                detectTransformGestures { _, _, acercamiento, _ ->
                                    if (acercamiento != 1f) {
                                        val nuevo = (zoom * acercamiento).coerceIn(1f, zoomMaximo)
                                        zoom = nuevo
                                        camara?.cameraControl?.setZoomRatio(nuevo)
                                    }
                                }
                            }
                    ) {
                        MarcoDeEncuadre(Modifier.fillMaxSize())

                        ChipDeLuz(
                            luminancia = luminancia,
                            modifier = Modifier
                                .align(Alignment.TopCenter)
                                .padding(top = 16.dp),
                        )

                        if (zoomMaximo > 1f) {
                            ChipZoom(
                                zoom = zoom,
                                maximo = zoomMaximo,
                                onReiniciar = {
                                    zoom = 1f
                                    camara?.cameraControl?.setZoomRatio(1f)
                                },
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(16.dp),
                            )
                        }
                    }
                } else {
                    SinPermiso(
                        rechazado = permisoRechazado,
                        onPedir = { pedirPermiso.launch(Manifest.permission.CAMERA) },
                    )
                }
            }

            FilaDeConsejos()

            BarraInferior(
                onGaleria = {
                    galeria.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                    )
                },
                linternaEncendida = linterna,
                linternaDisponible = camara?.cameraInfo?.hasFlashUnit() == true,
                onLinterna = { linterna = !linterna },
                onDisparar = {
                    if (permisoConcedido) {
                        disparar(context, capturador, onFoto, onError)
                    } else {
                        runCatching {
                            val archivo = Imagenes.archivoTemporalDeCaptura(context)
                            val uri = androidx.core.content.FileProvider.getUriForFile(
                                context,
                                "${com.madera.identificador.BuildConfig.APPLICATION_ID}.fileprovider",
                                archivo,
                            )
                            uriSistema = uri
                            camaraSistema.launch(uri)
                        }.onFailure { onError("No se pudo abrir la cámara: ${it.message}") }
                    }
                },
            )

            ConsejoRapido()
        }
    }

    if (mostrarAyuda) {
        DialogoAyuda(
            onCerrar = { mostrarAyuda = false },
            onVerExplicacion = {
                mostrarAyuda = false
                onVerExplicacion()
            },
        )
    }
}

@Composable
private fun BarraSuperior(onAyuda: () -> Unit, onAjustes: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onAjustes) {
            Icon(Icons.Default.Settings, contentDescription = "Ajustes", tint = Color.White)
        }
        Text(
            "XiloScan",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onAyuda) {
            Icon(Icons.Default.HelpOutline, contentDescription = "Ayuda", tint = Color.White)
        }
    }
}

@Composable
private fun Aviso(titulo: String, detalle: String, alerta: Boolean = false) {
    val acento = if (alerta) Color(0xFFE0A24A) else Verde
    Row(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Panel)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(50))
                .background(acento.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.WbSunny, contentDescription = null, tint = acento)
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(titulo, color = Color.White, fontWeight = FontWeight.Bold)
            Text(detalle, color = TextoTenue, style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
        }
    }
    Spacer(Modifier.height(12.dp))
}

/** Esquinas de encuadre: ayudan a centrar la testa y a llenar el cuadro. */
@Composable
private fun MarcoDeEncuadre(modifier: Modifier = Modifier) {
    androidx.compose.foundation.Canvas(modifier) {
        val margen = size.minDimension * 0.08f
        val largo = size.minDimension * 0.14f
        val grosor = 6f
        val izq = margen
        val der = size.width - margen
        val arr = size.height * 0.16f
        val aba = size.height * 0.84f

        fun esquina(x: Float, y: Float, dx: Float, dy: Float) {
            drawLine(Color.White, Offset(x, y), Offset(x + dx, y), grosor, StrokeCap.Round)
            drawLine(Color.White, Offset(x, y), Offset(x, y + dy), grosor, StrokeCap.Round)
        }
        esquina(izq, arr, largo, largo)
        esquina(der, arr, -largo, largo)
        esquina(izq, aba, largo, -largo)
        esquina(der, aba, -largo, -largo)
    }
}

/**
 * Aviso de luz en vivo. La luz rasante y suficiente es lo que hace visibles los poros;
 * con poca luz el modelo recibe una imagen sin detalle y no hay prompt que lo arregle.
 */
@Composable
private fun ChipDeLuz(luminancia: Double, modifier: Modifier = Modifier) {
    if (luminancia < 0) return

    val (texto, color) = when {
        luminancia < 60 -> "Luz escasa" to Color(0xFFE0A24A)
        luminancia > 205 -> "Demasiada luz" to Color(0xFFE0A24A)
        else -> "Luz buena" to Verde
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(Color.Black.copy(alpha = 0.55f))
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.WbSunny, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(texto, color = Color.White, style = androidx.compose.material3.MaterialTheme.typography.labelMedium)
    }
}

/** Indicador de zoom; al tocarlo se vuelve a 1x. */
@Composable
private fun ChipZoom(
    zoom: Float,
    maximo: Float,
    onReiniciar: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(Color.Black.copy(alpha = 0.55f))
            .clickable(onClick = onReiniciar)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "%.1f×".format(zoom),
            color = if (zoom > 1f) Verde else Color.White,
            style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
        )
        if (zoom > 1f) {
            Spacer(Modifier.width(6.dp))
            Text(
                "toca para 1×",
                color = TextoTenue,
                style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            )
        } else {
            Spacer(Modifier.width(6.dp))
            Text(
                "pellizca para acercar (hasta ${"%.0f".format(maximo)}×)",
                color = TextoTenue,
                style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun FilaDeConsejos() {
    Row(
        modifier = Modifier
            .padding(16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Panel)
            .padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        Consejo("Centra la pieza", "Que el corte llene el marco.")
        Consejo("Acércate", "Hasta ver los poritos y los anillos.")
        Consejo("Luz de lado", "Sin flash de frente ni brillos.")
    }
}

@Composable
private fun Consejo(titulo: String, detalle: String) {
    Column(
        modifier = Modifier.width(105.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            titulo,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            detalle,
            color = TextoTenue,
            style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
private fun BarraInferior(
    onGaleria: () -> Unit,
    linternaEncendida: Boolean,
    linternaDisponible: Boolean,
    onLinterna: () -> Unit,
    onDisparar: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        BotonLateral("Galería", Icons.Default.PhotoLibrary, onGaleria)

        Box(
            modifier = Modifier
                .size(76.dp)
                .clip(RoundedCornerShape(50))
                .background(Verde.copy(alpha = 0.22f))
                .padding(6.dp),
            contentAlignment = Alignment.Center,
        ) {
            IconButton(
                onClick = onDisparar,
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(50))
                    .background(Verde),
            ) {
                Icon(Icons.Default.PhotoCamera, contentDescription = "Tomar foto", tint = Color.Black)
            }
        }

        if (linternaDisponible) {
            BotonLateral(
                if (linternaEncendida) "Apagar" else "Linterna",
                if (linternaEncendida) Icons.Default.FlashOn else Icons.Default.FlashOff,
                onLinterna,
            )
        } else {
            Spacer(Modifier.width(96.dp))
        }
    }
}

@Composable
private fun BotonLateral(texto: String, icono: ImageVector, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Panel)
            .width(96.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        IconButton(onClick = onClick) {
            Icon(icono, contentDescription = texto, tint = Color.White)
        }
        Text(
            texto,
            color = Color.White,
            style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(end = 8.dp),
        )
    }
}

@Composable
private fun ConsejoRapido() {
    Row(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .padding(bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Panel)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column {
            Text(
                "Consejo rápido",
                color = Verde,
                fontWeight = FontWeight.Bold,
                style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
            )
            Text(
                "Pasa el bisturí para dejar la cara limpia y mójala con un poquito de " +
                    "agua: los poros se ven mucho mejor.",
                color = TextoTenue,
                style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun SinPermiso(rechazado: Boolean, onPedir: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Default.PhotoCamera,
            contentDescription = null,
            tint = TextoTenue,
            modifier = Modifier.size(48.dp),
        )
        Spacer(Modifier.height(12.dp))
        Text(
            if (rechazado) "Sin permiso de cámara" else "Preparando la cámara…",
            color = Color.White,
            fontWeight = FontWeight.Bold,
        )
        if (rechazado) {
            Spacer(Modifier.height(6.dp))
            Text(
                "Puedes concederlo para usar el visor con guías, o seguir usando la cámara " +
                    "del sistema y la galería con los botones de abajo.",
                color = TextoTenue,
                style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.height(12.dp))
            TextButton(onClick = onPedir) { Text("Conceder permiso", color = Verde) }
        }
    }
}

@Composable
private fun DialogoAyuda(onCerrar: () -> Unit, onVerExplicacion: () -> Unit) {
    AlertDialog(
        onDismissRequest = onCerrar,
        title = { Text("Cómo tomar la foto") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                // Método del curso de Anatomía e Identificación de Maderas de la UNAL
                // sede Medellín: corte limpio con bisturí (no raspado) y humedecido.
                listOf(
                    "Fotografía la punta de la pieza, la cara que atraviesa la veta.",
                    "Pasa el bisturí o una navaja bien afilada: corta, no raspes. " +
                        "El corte de sierra deja la madera peluda y tapa los poros.",
                    "Échale un poco de agua con el dedo o un trapito. Espera a que se " +
                        "vaya el brillo y toma la foto.",
                    "Acércate hasta que el corte llene la pantalla, unos 3 a 5 cm de madera.",
                    "Luz de lado, entrando bajita. Nada de flash de frente.",
                    "Si tiene, ponle al lado una regla o una moneda para dar el tamaño.",
                    "Busca una zona limpia: sin nudos, sin corteza y sin manchas.",
                ).forEach { Text("•  $it", style = androidx.compose.material3.MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = { TextButton(onClick = onCerrar) { Text("Entendido") } },
        dismissButton = {
            TextButton(onClick = onVerExplicacion) { Text("Cómo funciona") }
        },
    )
}

/** Media de luminancia del plano Y, muestreada de forma dispersa para no cargar la CPU. */
private fun mediaDeLuz(imagen: ImageProxy): Double {
    val plano = imagen.planes.firstOrNull() ?: return -1.0
    val buffer = plano.buffer
    val total = buffer.remaining()
    if (total <= 0) return -1.0

    var suma = 0L
    var muestras = 0
    val salto = maxOf(1, total / 2048)
    var i = 0
    while (i < total) {
        suma += buffer.get(i).toInt() and 0xFF
        muestras++
        i += salto
    }
    return if (muestras == 0) -1.0 else suma.toDouble() / muestras
}

private fun disparar(
    context: android.content.Context,
    capturador: ImageCapture,
    alTomarFoto: (Uri) -> Unit,
    alFallar: (String) -> Unit,
) {
    val archivo = Imagenes.archivoTemporalDeCaptura(context)
    val opciones = ImageCapture.OutputFileOptions.Builder(archivo).build()

    capturador.takePicture(
        opciones,
        ContextCompat.getMainExecutor(context),
        // Los parametros se llaman alTomarFoto/alFallar y no onFoto/onError a proposito:
        // dentro del objeto anonimo, "onError(...)" resolveria al metodo del callback.
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(resultado: ImageCapture.OutputFileResults) {
                alTomarFoto(resultado.savedUri ?: Uri.fromFile(archivo))
            }

            override fun onError(excepcion: androidx.camera.core.ImageCaptureException) {
                alFallar("No se pudo tomar la foto: ${excepcion.message}")
            }
        },
    )
}
