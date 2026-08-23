package com.bioscan.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.bioscan.app.data.Alternativa
import com.bioscan.app.data.Candidata
import com.bioscan.app.data.Identificacion
import com.bioscan.app.util.Imagenes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PantallaPrincipal(vm: BioViewModel = viewModel()) {
    val contexto = LocalContext.current
    val teclado = LocalSoftwareKeyboardController.current

    val estado by vm.estado.collectAsStateWithLifecycle()
    val consulta by vm.consulta.collectAsStateWithLifecycle()

    var enAjustes by remember { mutableStateOf(false) }
    var uriDeCaptura by remember { mutableStateOf<Uri?>(null) }

    val camara = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) uriDeCaptura?.let { vm.identificarFoto(it) }
    }

    val galeria = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> uri?.let { vm.identificarFoto(it) } }

    if (enAjustes) {
        PantallaAjustes(vm = vm, onCerrar = { enAjustes = false })
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("BioScan") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                actions = {
                    IconButton(onClick = { enAjustes = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Ajustes")
                    }
                },
            )
        }
    ) { relleno ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(relleno)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Buscador(
                consulta = consulta,
                onCambio = vm::alEscribir,
                onBuscar = {
                    teclado?.hide()
                    vm.consultarPorNombre()
                },
                onLimpiar = { vm.alEscribir("") },
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = {
                        val archivo = Imagenes.archivoTemporalDeCaptura(contexto)
                        val uri = FileProvider.getUriForFile(
                            contexto,
                            "${contexto.packageName}.fileprovider",
                            archivo,
                        )
                        uriDeCaptura = uri
                        camara.launch(uri)
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("Tomar foto") }

                OutlinedButton(
                    onClick = {
                        galeria.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("De la galería") }
            }

            when (val e = estado) {
                is Estado.Reposo -> Instrucciones()

                is Estado.Trabajando -> Trabajando(e.mensaje)

                is Estado.FichaLista -> {
                    BarraDeVuelta(vm)
                    CuerpoDeFicha(e.ficha)
                }

                is Estado.HayQueElegir -> ListaDeCandidatas(
                    aviso = e.aviso,
                    nota = e.notaDelModelo,
                    candidatas = e.candidatas,
                    onElegir = vm::elegirCandidata,
                )

                is Estado.Identificada -> ResultadoDeFoto(e, vm)

                is Estado.Vacio -> Mensaje(
                    titulo = "Sin resultados",
                    texto = e.aviso ?: "No se encontró esa especie.",
                )

                is Estado.Fallo -> Mensaje(
                    titulo = e.mensaje,
                    texto = e.detalle ?: "",
                    codigo = e.codigo,
                    error = true,
                )
            }
        }
    }
}

/* --------------------------------------------------------------------- buscador */

@Composable
private fun Buscador(
    consulta: String,
    onCambio: (String) -> Unit,
    onBuscar: () -> Unit,
    onLimpiar: () -> Unit,
) {
    OutlinedTextField(
        value = consulta,
        onValueChange = onCambio,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Nombre común o científico") },
        placeholder = { Text("roble, chingalé, Quercus humboldtii…") },
        singleLine = true,
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
        trailingIcon = {
            if (consulta.isNotEmpty()) {
                IconButton(onClick = onLimpiar) {
                    Icon(Icons.Default.Close, contentDescription = "Limpiar")
                }
            }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onBuscar() }),
    )

    Button(
        onClick = onBuscar,
        enabled = consulta.trim().length >= 2,
        modifier = Modifier.fillMaxWidth(),
    ) { Text("Consultar") }
}

@Composable
private fun Instrucciones() {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
        )
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text("Qué te dice esta app", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text(
                "Escribe un nombre o toma una foto de una planta o un animal, y te dice " +
                    "si es nativa o exótica, si es endémica, en qué categoría de amenaza " +
                    "está, si está vedada y cuál es su rango de distribución.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "Los datos legales y de conservación salen de las listas oficiales " +
                    "colombianas cargadas en el servidor, con su norma citada. El nombre " +
                    "que sale de una foto lo propone la IA y puede equivocarse.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun Trabajando(mensaje: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator()
        Spacer(Modifier.height(12.dp))
        Text(mensaje, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun BarraDeVuelta(vm: BioViewModel) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (vm.puedeVolverALasCandidatas) {
            TextButton(onClick = vm::volverALasCandidatas) { Text("Volver a la lista") }
        }
        TextButton(onClick = vm::volverAlInicio) { Text("Nueva consulta") }
    }
}

/* ------------------------------------------------------------------ candidatas */

@Composable
private fun ListaDeCandidatas(
    aviso: String?,
    nota: String?,
    candidatas: List<Candidata>,
    onElegir: (Candidata) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        aviso?.let { Text(it, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold) }
        nota?.takeIf { it.isNotBlank() }?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        candidatas.forEach { c ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable { onElegir(c) },
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        c.nombreCientifico ?: "",
                        style = MaterialTheme.typography.titleMedium,
                        fontStyle = FontStyle.Italic,
                        fontWeight = FontWeight.Bold,
                    )
                    listOfNotNull(c.familia, c.nombresComunes ?: c.nombreComun)
                        .filter { it.isNotBlank() }
                        .takeIf { it.isNotEmpty() }
                        ?.let {
                            Text(
                                it.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    c.dondeSeUsa?.takeIf { it.isNotBlank() }?.let {
                        Text(
                            "Se le llama así en: $it",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    // Las banderas van aqui porque son justo lo que hace elegir una u otra:
                    // dos especies con el mismo nombre comun pueden diferir en que una este
                    // amenazada y la otra no.
                    val banderas = buildList {
                        if (c.endemica == true) add("Endémica")
                        c.amenaza?.let { add(it) }
                        if (c.vedada == true) add("Vedada")
                        c.origen?.takeIf { it == "exotica" }?.let { add("Exótica") }
                    }
                    if (banderas.isNotEmpty()) {
                        Text(
                            banderas.joinToString(" · "),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 6.dp),
                        )
                    }
                }
            }
        }
    }
}

/* ------------------------------------------------------------- resultado de foto */

@Composable
private fun ResultadoDeFoto(e: Estado.Identificada, vm: BioViewModel) {
    val id = e.identificacion

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BarraDeVuelta(vm)

        e.vistaPrevia?.let { bitmap ->
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Fotografía analizada",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .background(Color.Black, RoundedCornerShape(10.dp)),
            )
        }

        if (id.esSerVivo == false) {
            Mensaje(
                titulo = "En la foto no se ve un ser vivo",
                texto = id.limitaciones.orEmpty().joinToString("\n") { "· $it" },
                error = true,
            )
            return@Column
        }

        TarjetaDeIdentificacion(id)

        // Lo oficial va debajo del nombre propuesto, no mezclado con el: el nombre lo dijo
        // el modelo y todo lo de abajo depende de que ese nombre sea el correcto.
        e.oficial?.let { CuerpoDeFicha(it) }

        if (e.alternativas.isNotEmpty()) {
            AlternativasDeFoto(e.alternativas, vm)
        }

        id.recomendacionesCaptura?.takeIf { it.isNotEmpty() }?.let { consejos ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Para afinar la identificación", fontWeight = FontWeight.Bold)
                    consejos.forEach {
                        Text("· $it", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        Text(
            listOfNotNull(
                e.modelo?.let { "Modelo: $it" },
                e.latenciaMs?.let { "${it / 1000.0} s" },
            ).joinToString(" · "),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun TarjetaDeIdentificacion(id: Identificacion) {
    Card(elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                "Identificación por IA",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Text(
                id.nombreComun?.takeIf { it != "desconocido" } ?: "Sin nombre común",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                id.nombreCientifico ?: "",
                style = MaterialTheme.typography.titleMedium,
                fontStyle = FontStyle.Italic,
            )
            listOfNotNull(id.familia, id.tipoDeOrganismo, id.grupo)
                .filter { it.isNotBlank() }
                .takeIf { it.isNotEmpty() }
                ?.let {
                    Text(
                        it.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

            Spacer(Modifier.height(10.dp))
            Confianza(id.confianza, id.nivelAlcanzado)

            id.caracteresObservados?.takeIf { it.isNotEmpty() }?.let { caracteres ->
                Spacer(Modifier.height(10.dp))
                Text("Lo que se ve en la foto", fontWeight = FontWeight.Bold)
                caracteres.forEach {
                    Text("· $it", style = MaterialTheme.typography.bodyMedium)
                }
            }

            id.habitat?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(10.dp))
                Text("Hábitat", fontWeight = FontWeight.Bold)
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
            id.historiaNatural?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(10.dp))
                Text("Cómo vive", fontWeight = FontWeight.Bold)
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }

            id.limitaciones?.takeIf { it.isNotEmpty() }?.let { limites ->
                Spacer(Modifier.height(10.dp))
                Text("Límites de este análisis", fontWeight = FontWeight.Bold)
                limites.forEach {
                    Text("· $it", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

/**
 * La confianza, con su lectura en palabras.
 *
 * El numero solo no dice nada a quien no trabaja con probabilidades, y en XiloScan se
 * aprendio que una confianza que siempre ronda el 0,9 acaba siendo ruido. Por debajo de
 * 0,6 se dice explicitamente que el nombre esta sin confirmar.
 */
@Composable
private fun Confianza(valor: Double?, nivel: String?) {
    val confianza = valor ?: 0.0
    val color = when {
        confianza >= 0.7 -> Color(0xFF2E6B52)
        confianza >= 0.5 -> Color(0xFFB2670A)
        else -> Color(0xFFB3261E)
    }

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                when {
                    confianza >= 0.7 -> "Identificación probable"
                    confianza >= 0.5 -> "Identificación posible, sin confirmar"
                    else -> "Solo una candidata: no está confirmada"
                },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = color,
            )
            Text("${(confianza * 100).toInt()} %", fontWeight = FontWeight.Bold, color = color)
        }
        LinearProgressIndicator(
            progress = { confianza.toFloat().coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            color = color,
        )
        nivel?.takeIf { it.isNotBlank() }?.let {
            Text(
                "Llega hasta el nivel de $it.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun AlternativasDeFoto(alternativas: List<Alternativa>, vm: BioViewModel) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("Otras posibilidades", fontWeight = FontWeight.Bold)
            Text(
                "Toca una para ver su ficha oficial.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))

            alternativas.forEach { alt ->
                val nombre = alt.nombreCientifico
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .border(
                            1.dp,
                            MaterialTheme.colorScheme.outlineVariant,
                            RoundedCornerShape(8.dp),
                        )
                        .clickable(enabled = nombre != null) {
                            nombre?.let(vm::consultarNombreCientifico)
                        }
                        .padding(10.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            nombre ?: "",
                            fontStyle = FontStyle.Italic,
                            fontWeight = FontWeight.Bold,
                        )
                        alt.confianza?.let { Text("${(it * 100).toInt()} %") }
                    }
                    alt.nombreComun?.takeIf { it.isNotBlank() }?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall)
                    }

                    // Si la alternativa esta vedada o amenazada hay que verlo aqui: puede
                    // ser mas importante que cual sea la principal.
                    val banderas = buildList {
                        alt.oficial?.amenaza?.nacional?.categoria?.let { add(it) }
                        if (!alt.oficial?.vedas.isNullOrEmpty()) add("Vedada")
                        if (alt.oficial?.endemica?.valor == true) add("Endémica")
                    }
                    if (banderas.isNotEmpty()) {
                        Text(
                            banderas.joinToString(" · "),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }

                    alt.motivo?.takeIf { it.isNotBlank() }?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }
        }
    }
}

/* ---------------------------------------------------------------------- mensajes */

@Composable
private fun Mensaje(titulo: String, texto: String, codigo: String? = null, error: Boolean = false) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (error) {
                MaterialTheme.colorScheme.errorContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
        )
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(titulo, fontWeight = FontWeight.Bold)
            if (texto.isNotBlank()) {
                Text(
                    texto,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            codigo?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

