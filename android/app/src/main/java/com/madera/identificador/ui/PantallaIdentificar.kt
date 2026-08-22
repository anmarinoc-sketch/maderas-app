package com.madera.identificador.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.madera.identificador.BuildConfig
import com.madera.identificador.data.Alternativa
import com.madera.identificador.data.ResultadoMadera
import com.madera.identificador.util.Imagenes
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PantallaIdentificar(
    onVerExplicacion: () -> Unit = {},
    vm: IdentificarViewModel = viewModel(),
) {
    val estado by vm.estado.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    var mostrarAjustes by remember { mutableStateOf(false) }
    var aviso by remember { mutableStateOf<String?>(null) }

    // Sin foto elegida, la app arranca en el visor de camara. Es la pantalla de trabajo:
    // la calidad del encuadre y de la luz decide el resto del analisis.
    if (estado.imagen == null) {
        val error = estado.analisis as? EstadoAnalisis.Error
        PantallaCaptura(
            onFoto = vm::seleccionarImagen,
            onError = { aviso = it },
            onAjustes = { mostrarAjustes = true },
            onVerExplicacion = onVerExplicacion,
            mensaje = aviso ?: error?.mensaje,
        )
        if (mostrarAjustes) {
            DialogoAjustes(
                urlActual = estado.urlServidor,
                claveActual = estado.claveApp,
                comprobando = estado.comprobandoServidor,
                mensaje = estado.mensajeServidor,
                onProbar = vm::probarServidor,
                onGuardar = { url, clave ->
                    vm.guardarAjustes(url, clave)
                    mostrarAjustes = false
                },
                onCerrar = { mostrarAjustes = false },
            )
        }
        return
    }

    // Entre la foto y el analisis va el editor: girar, acercar y recortar. Encuadrar
    // aqui gana resolucion util, porque el servidor reduce la imagen a 1600 px de lado.
    if (!estado.ajustada) {
        estado.imagen?.let { imagen ->
            PantallaAjusteFoto(
                original = imagen.vistaPrevia,
                onConfirmar = vm::confirmarAjuste,
                onRepetir = vm::limpiar,
            )
        }
        return
    }

    LaunchedEffect(aviso) {
        aviso?.let {
            snackbar.showSnackbar(it)
            aviso = null
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("XiloScan") },
                actions = {
                    IconButton(onClick = { mostrarAjustes = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Ajustes del servidor")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { relleno ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(relleno)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ZonaImagen(
                vistaPrevia = estado.imagen?.vistaPrevia?.asImageBitmap(),
                pesoKb = estado.imagen?.kilobytes,
                onQuitar = vm::limpiar,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = vm::volverAAjustar,
                ) {
                    Text("Reencuadrar")
                }
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = vm::limpiar,
                ) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Repetir foto")
                }
            }

            val cargando = estado.analisis is EstadoAnalisis.Cargando
            Button(
                modifier = Modifier.fillMaxWidth(),
                enabled = estado.imagen != null && !cargando,
                onClick = vm::identificar,
            ) {
                Icon(Icons.Default.Search, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(if (cargando) "Analizando…" else "Identificar especie")
            }

            when (val analisis = estado.analisis) {
                is EstadoAnalisis.Inicial -> Unit

                is EstadoAnalisis.Cargando -> TarjetaCargando()

                is EstadoAnalisis.Error -> TarjetaError(
                    codigo = analisis.codigo,
                    mensaje = analisis.mensaje,
                    detalle = analisis.detalle,
                    onReintentar = vm::identificar,
                    onAjustes = { mostrarAjustes = true },
                )

                is EstadoAnalisis.Exito -> {
                    BloqueResultado(
                        resultado = analisis.resultado,
                        modelo = analisis.modelo,
                        latenciaMs = analisis.latenciaMs,
                    )
                    TarjetaVerificacion(
                        propuesta = analisis.resultado.nombreCientifico ?: "desconocido",
                        enviando = estado.enviandoVerificacion,
                        enviada = estado.verificacionEnviada,
                        mensaje = estado.mensajeVerificacion,
                        onAcierto = { vm.verificar(acierto = true) },
                        onCorregir = { especie -> vm.verificar(acierto = false, especieReal = especie) },
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }

    if (mostrarAjustes) {
        DialogoAjustes(
            urlActual = estado.urlServidor,
            claveActual = estado.claveApp,
            comprobando = estado.comprobandoServidor,
            mensaje = estado.mensajeServidor,
            onProbar = vm::probarServidor,
            onGuardar = { url, clave ->
                vm.guardarAjustes(url, clave)
                mostrarAjustes = false
                aviso = "Servidor actualizado"
            },
            onCerrar = { mostrarAjustes = false },
        )
    }
}

@Composable
private fun ZonaImagen(
    vistaPrevia: androidx.compose.ui.graphics.ImageBitmap?,
    pesoKb: Int?,
    onQuitar: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 220.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        if (vistaPrevia == null) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 220.dp)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(
                    Icons.Default.PhotoCamera,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    "Fotografía la cara del corte",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    "La punta de la pieza, la que atraviesa la veta",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            Box {
                Image(
                    bitmap = vistaPrevia,
                    contentDescription = "Corte transversal seleccionado",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 220.dp, max = 320.dp)
                        .clip(RoundedCornerShape(12.dp)),
                )
                IconButton(
                    onClick = onQuitar,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .background(
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
                            RoundedCornerShape(50),
                        ),
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Quitar imagen")
                }
                pesoKb?.let {
                    Text(
                        "$it KB",
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(8.dp)
                            .background(
                                MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
                                RoundedCornerShape(6.dp),
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun TarjetaCargando() {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
            Spacer(Modifier.width(16.dp))
            Column {
                Text("Analizando la anatomía…", style = MaterialTheme.typography.titleSmall)
                Text(
                    "Suele tardar entre 10 y 20 segundos",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun TarjetaError(
    codigo: String,
    mensaje: String,
    detalle: String?,
    onReintentar: () -> Unit,
    onAjustes: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer,
        )
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Warning, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(mensaje, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
            detalle?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Text(codigo, style = MaterialTheme.typography.labelSmall)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onReintentar) { Text("Reintentar") }
                if (codigo == "SIN_CONEXION" || codigo == "NO_AUTORIZADO" || codigo == "ERROR_TLS") {
                    TextButton(onClick = onAjustes) { Text("Revisar servidor") }
                }
            }
        }
    }
}

@Composable
private fun BloqueResultado(resultado: ResultadoMadera, modelo: String?, latenciaMs: Long?) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {

        if (resultado.identificacionPosible != true) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer,
                )
            ) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = null)
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "No se pudo identificar la especie con esta imagen.",
                        style = MaterialTheme.typography.titleSmall,
                    )
                }
            }
        } else {
            // Por debajo de 0,6 el resultado se presenta como candidata, no como veredicto:
            // la identificación macroscópica desde una foto rara vez da para más, y una
            // respuesta rotunda equivocada es peor que una propuesta con reservas.
            val fiable = (resultado.confianza ?: 0.0) >= 0.6

            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (fiable) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
                    contentColor = if (fiable) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        if (fiable) "Identificación" else "Candidata más probable · sin confirmar",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        resultado.nombreComun ?: "desconocido",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        resultado.nombreCientifico ?: "desconocido",
                        style = MaterialTheme.typography.titleMedium,
                        fontStyle = FontStyle.Italic,
                    )
                    Text(
                        "Familia: ${resultado.familia ?: "desconocida"}",
                        style = MaterialTheme.typography.bodyMedium,
                    )

                    resultado.nombresAlternativos?.takeIf { it.isNotEmpty() }?.let {
                        Text(
                            "También: ${it.joinToString(", ")}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }

                    Spacer(Modifier.height(8.dp))
                    BarraConfianza(resultado.confianza ?: 0.0)

                    if (!fiable) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Contrasta con las otras especies compatibles antes de decidir.",
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }

                    when (resultado.origenIdentificacion) {
                        "guia_valle_aburra" -> "Contrastada con la guía de maderas comerciales del Valle de Aburrá"
                        "conocimiento_general" -> "Fuera de la guía regional: identificación por conocimiento general"
                        else -> null
                    }?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(it, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }

        resultado.caracteristicas?.comoFilas()?.takeIf { it.isNotEmpty() }?.let { filas ->
            Seccion("Anatomía observada") {
                filas.forEachIndexed { indice, (etiqueta, valor) ->
                    if (indice > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    Text(etiqueta, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    Text(valor, style = MaterialTheme.typography.bodyMedium)
                }
                resultado.caracteristicas?.otrosRasgos?.takeIf { it.isNotEmpty() }?.let { rasgos ->
                    HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    Text("Otros rasgos", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    rasgos.forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium) }
                }
            }
        }

        resultado.alternativas?.takeIf { it.isNotEmpty() }?.let { alternativas ->
            Seccion("Otras especies compatibles") {
                alternativas.forEachIndexed { indice, alternativa ->
                    if (indice > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    FilaAlternativa(alternativa)
                }
            }
        }

        resultado.usos?.takeIf { it.isNotEmpty() }?.let { usos ->
            Seccion("Usos habituales") {
                usos.forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium) }
            }
        }

        resultado.limitaciones?.takeIf { it.isNotEmpty() }?.let { limitaciones ->
            Seccion("Limitaciones del análisis") {
                limitaciones.forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium) }
            }
        }

        resultado.recomendaciones?.takeIf { it.isNotEmpty() }?.let { recomendaciones ->
            Seccion("Cómo mejorar la foto") {
                recomendaciones.forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium) }
            }
        }

        Text(
            buildString {
                append("Calidad de imagen: ${resultado.calidadImagen ?: "desconocida"}")
                modelo?.let { append(" · $it") }
                latenciaMs?.let { append(" · ${it / 1000.0} s") }
            },
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Text(
            "Esto es una ayuda, no un peritaje. Confirmar una especie con seguridad exige " +
                "microscopio y, en maderas protegidas, análisis de laboratorio.",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun BarraConfianza(confianza: Double) {
    val porcentaje = (confianza.coerceIn(0.0, 1.0) * 100).roundToInt()
    Column {
        Text("Confianza: $porcentaje %", style = MaterialTheme.typography.labelMedium)
        Spacer(Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { confianza.coerceIn(0.0, 1.0).toFloat() },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
        )
    }
}

@Composable
private fun FilaAlternativa(alternativa: Alternativa) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                alternativa.nombreComun ?: "desconocido",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "${((alternativa.confianza ?: 0.0) * 100).roundToInt()} %",
                style = MaterialTheme.typography.labelMedium,
            )
        }
        Text(
            "${alternativa.nombreCientifico ?: "desconocido"} · ${alternativa.familia ?: "—"}",
            style = MaterialTheme.typography.bodySmall,
            fontStyle = FontStyle.Italic,
        )
        alternativa.motivo?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun Seccion(titulo: String, contenido: @Composable () -> Unit) {
    Card {
        Column(Modifier.padding(16.dp)) {
            Text(
                titulo,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(8.dp))
            contenido()
        }
    }
}

/**
 * Verificacion del usuario sobre el resultado.
 *
 * No entrena al modelo — Gemini no aprende de una peticion a la siguiente —, pero el
 * servidor acumula estas confirmaciones y correcciones y las envia como avisos en las
 * consultas posteriores, para que los errores comprobados no se repitan.
 */
@Composable
private fun TarjetaVerificacion(
    propuesta: String,
    enviando: Boolean,
    enviada: Boolean,
    mensaje: String?,
    onAcierto: () -> Unit,
    onCorregir: (String) -> Unit,
) {
    var corrigiendo by remember { mutableStateOf(false) }
    var especie by remember { mutableStateOf("") }

    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        )
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {

            if (enviada) {
                Text(
                    mensaje ?: "Verificación registrada.",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Se tendrá en cuenta en los próximos análisis.",
                    style = MaterialTheme.typography.labelSmall,
                )
            } else {
            Text(
                "¿Acertó?",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Confirmar o corregir hace que el análisis no repita el mismo error.",
                style = MaterialTheme.typography.bodySmall,
            )

            if (!corrigiendo) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onAcierto, enabled = !enviando) {
                        Text("Sí, es $propuesta")
                    }
                    OutlinedButton(onClick = { corrigiendo = true }, enabled = !enviando) {
                        Text("No, fue otra")
                    }
                }
            } else {
                OutlinedTextField(
                    value = especie,
                    onValueChange = { especie = it },
                    label = { Text("¿Cuál es la especie correcta?") },
                    placeholder = { Text("Nombre común o científico") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { onCorregir(especie.trim()) },
                        enabled = !enviando && especie.isNotBlank(),
                    ) {
                        Text("Enviar corrección")
                    }
                    TextButton(onClick = { corrigiendo = false }, enabled = !enviando) {
                        Text("Cancelar")
                    }
                }
            }

            if (enviando) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text("Enviando…", style = MaterialTheme.typography.labelSmall)
                }
            }

            mensaje?.let {
                Text(it, style = MaterialTheme.typography.labelSmall)
            }
            }
        }
    }
}

@Composable
private fun DialogoAjustes(
    urlActual: String,
    claveActual: String,
    comprobando: Boolean,
    mensaje: String?,
    onProbar: (String) -> Unit,
    onGuardar: (String, String) -> Unit,
    onCerrar: () -> Unit,
) {
    var url by remember { mutableStateOf(urlActual) }
    var clave by remember { mutableStateOf(claveActual) }

    AlertDialog(
        onDismissRequest = onCerrar,
        title = { Text("Servidor") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("URL del backend") },
                    placeholder = { Text("https://mi-backend.example.com") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = clave,
                    onValueChange = { clave = it },
                    label = { Text("X-App-Key (opcional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "La app ya viene apuntando al servidor de XiloScan en internet: funciona " +
                        "con cualquier wifi o con datos móviles, y no depende de ningún equipo " +
                        "tuyo encendido. Solo cambia esto si sabes que hay otro servidor.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { onProbar(url) }, enabled = !comprobando) {
                        Text("Probar conexión")
                    }
                    if (comprobando) {
                        Spacer(Modifier.width(8.dp))
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    }
                }
                mensaje?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = { Button(onClick = { onGuardar(url, clave) }) { Text("Guardar") } },
        dismissButton = { TextButton(onClick = onCerrar) { Text("Cancelar") } },
    )
}
