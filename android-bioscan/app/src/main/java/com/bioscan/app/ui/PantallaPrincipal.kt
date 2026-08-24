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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.bioscan.app.R
import com.bioscan.app.data.Alternativa
import com.bioscan.app.data.Candidata
import com.bioscan.app.data.Identificacion
import com.bioscan.app.ui.theme.TextoClaro
import com.bioscan.app.ui.theme.TextoTenue
import com.bioscan.app.ui.theme.VerdeBorde
import com.bioscan.app.ui.theme.VerdeFondo
import com.bioscan.app.ui.theme.VerdeMarca
import com.bioscan.app.ui.theme.VerdePanel
import com.bioscan.app.ui.theme.VerdePanelClaro
import com.bioscan.app.ui.theme.VerdeSuave
import com.bioscan.app.util.Imagenes

/** Las cuatro secciones de la barra inferior. */
private enum class Seccion(val etiqueta: String, val icono: ImageVector) {
    INICIO("Inicio", Icons.Default.Home),
    HISTORIAL("Historial", Icons.Default.History),
    FAVORITOS("Favoritos", Icons.Default.Favorite),
    MAS("Más", Icons.Default.MoreHoriz),
}

@Composable
fun PantallaPrincipal(vm: BioViewModel = viewModel()) {
    val contexto = LocalContext.current
    val estado by vm.estado.collectAsStateWithLifecycle()

    var seccion by remember { mutableStateOf(Seccion.INICIO) }
    var enAjustes by remember { mutableStateOf(false) }
    var uriDeCaptura by remember { mutableStateOf<Uri?>(null) }

    val camara = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) uriDeCaptura?.let { vm.prepararFoto(it) }
    }
    val galeria = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> uri?.let { vm.prepararFoto(it) } }

    /** Cualquier sección que abra una ficha vuelve a Inicio, que es donde se pinta. */
    val abrir: (String) -> Unit = { nombre ->
        seccion = Seccion.INICIO
        vm.consultarNombreCientifico(nombre)
    }

    if (enAjustes) {
        PantallaAjustes(vm = vm, onCerrar = { enAjustes = false })
        return
    }

    // El ajuste de la foto se lleva la pantalla entera: recortar con la barra de búsqueda
    // encima sería imposible de usar.
    (estado as? Estado.Ajustando)?.let { ajuste ->
        PantallaAjusteFoto(
            original = ajuste.original,
            onConfirmar = { vm.identificarFoto(it) },
            onRepetir = { vm.volverAlInicio() },
        )
        return
    }

    Scaffold(
        containerColor = VerdeFondo,
        bottomBar = { BarraInferior(seccion) { seccion = it } },
    ) { relleno ->
        Box(Modifier.fillMaxSize().padding(relleno)) {
            when (seccion) {
                Seccion.INICIO -> Inicio(
                    vm = vm,
                    onAjustes = { enAjustes = true },
                    onTomarFoto = {
                        val archivo = Imagenes.archivoTemporalDeCaptura(contexto)
                        val uri = FileProvider.getUriForFile(
                            contexto,
                            "${contexto.packageName}.fileprovider",
                            archivo,
                        )
                        uriDeCaptura = uri
                        camara.launch(uri)
                    },
                    onGaleria = {
                        galeria.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                )

                Seccion.HISTORIAL -> PantallaHistorial(vm, onAbrir = abrir)
                Seccion.FAVORITOS -> PantallaFavoritos(vm, onAbrir = abrir)
                Seccion.MAS -> PantallaMas(onAjustes = { enAjustes = true })
            }
        }
    }
}

/* --------------------------------------------------------------- barra inferior */

@Composable
private fun BarraInferior(actual: Seccion, onSeleccionar: (Seccion) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(VerdePanel)
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        Seccion.entries.forEach { s ->
            val activa = s == actual
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .clickable { onSeleccionar(s) }
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .background(
                            if (activa) VerdeMarca.copy(alpha = 0.18f) else Color.Transparent,
                            CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        s.icono,
                        contentDescription = s.etiqueta,
                        tint = if (activa) VerdeMarca else TextoTenue,
                        modifier = Modifier.size(21.dp),
                    )
                }
                Text(
                    s.etiqueta,
                    color = if (activa) VerdeMarca else TextoTenue,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

/* ------------------------------------------------------------------------ inicio */

@Composable
private fun Inicio(
    vm: BioViewModel,
    onAjustes: () -> Unit,
    onTomarFoto: () -> Unit,
    onGaleria: () -> Unit,
) {
    val teclado = LocalSoftwareKeyboardController.current
    val estado by vm.estado.collectAsStateWithLifecycle()
    val consulta by vm.consulta.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Cabecera(onAjustes)

        Buscador(
            consulta = consulta,
            onCambio = vm::alEscribir,
            onBuscar = {
                teclado?.hide()
                vm.consultarPorNombre()
            },
            onLimpiar = { vm.alEscribir("") },
        )

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TarjetaAccion(
                icono = Icons.Default.PhotoCamera,
                titulo = "Tomar foto",
                apoyo = "Captura al instante",
                destacada = true,
                modifier = Modifier.weight(1f),
                onClick = onTomarFoto,
            )
            TarjetaAccion(
                icono = Icons.Default.PhotoLibrary,
                titulo = "De la galería",
                apoyo = "Selecciona una imagen",
                modifier = Modifier.weight(1f),
                onClick = onGaleria,
            )
        }

        when (val e = estado) {
            is Estado.Reposo -> QueTeDice()

            is Estado.Trabajando -> Trabajando(e.mensaje)

            is Estado.FichaLista -> {
                BarraDeVuelta(vm)
                CuerpoDeFicha(e.ficha, vm)
            }

            is Estado.HayQueElegir -> ListaDeCandidatas(
                aviso = e.aviso,
                nota = e.notaDelModelo,
                candidatas = e.candidatas,
                onElegir = vm::elegirCandidata,
            )

            is Estado.Identificada -> ResultadoDeFoto(e, vm)

            is Estado.Vacio -> Mensaje("Sin resultados", e.aviso ?: "No se encontró esa especie.")

            is Estado.Fallo -> Mensaje(e.mensaje, e.detalle ?: "", e.codigo, error = true)

            // Se pinta a pantalla completa, antes del Scaffold.
            is Estado.Ajustando -> Unit
        }
    }
}

@Composable
private fun Cabecera(onAjustes: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(R.drawable.logo_bioscan),
            contentDescription = null,
            modifier = Modifier.size(70.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = TextoClaro)) { append("Bio") }
                    withStyle(SpanStyle(color = VerdeMarca)) { append("Scan") }
                },
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Explora y protege\nla biodiversidad que te rodea.",
                color = TextoTenue,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(VerdePanelClaro, CircleShape)
                .clickable(onClick = onAjustes),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Settings, contentDescription = "Ajustes", tint = VerdeSuave)
        }
    }
}

@Composable
private fun Buscador(
    consulta: String,
    onCambio: (String) -> Unit,
    onBuscar: () -> Unit,
    onLimpiar: () -> Unit,
) {
    val forma = RoundedCornerShape(30.dp)

    OutlinedTextField(
        value = consulta,
        onValueChange = onCambio,
        modifier = Modifier.fillMaxWidth(),
        shape = forma,
        placeholder = { Text("Nombre común o científico", color = TextoTenue) },
        singleLine = true,
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextoClaro) },
        trailingIcon = {
            if (consulta.isNotEmpty()) {
                IconButton(onClick = onLimpiar) {
                    Icon(Icons.Default.Close, contentDescription = "Limpiar", tint = TextoTenue)
                }
            }
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = VerdeMarca,
            unfocusedBorderColor = VerdeBorde,
            focusedContainerColor = VerdePanel.copy(alpha = 0.6f),
            unfocusedContainerColor = VerdePanel.copy(alpha = 0.6f),
            focusedTextColor = TextoClaro,
            unfocusedTextColor = TextoClaro,
            cursorColor = VerdeMarca,
        ),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onBuscar() }),
    )

    Spacer(Modifier.height(2.dp))

    val activo = consulta.trim().length >= 2
    val forma2 = RoundedCornerShape(18.dp)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(58.dp)
            .clip(forma2)
            .then(
                if (activo) {
                    Modifier.background(
                        Brush.horizontalGradient(listOf(Color(0xFF3FA05F), Color(0xFF2A6B41))),
                        forma2,
                    )
                } else {
                    Modifier.background(VerdePanel.copy(alpha = 0.5f), forma2)
                        .border(1.dp, VerdeBorde.copy(alpha = 0.6f), forma2)
                }
            )
            .clickable(enabled = activo, onClick = onBuscar),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Default.Spa,
            contentDescription = null,
            tint = if (activo) Color.White else TextoTenue,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(
            "Consultar",
            color = if (activo) Color.White else TextoTenue,
            fontWeight = FontWeight.Bold,
            fontSize = 17.sp,
        )
    }
}

/**
 * Qué responde la app, en forma de preguntas.
 *
 * Cada fila se puede tocar y despliega qué significa ese concepto. La flecha de la
 * maqueta pedía que llevaran a alguna parte, y explicar el término es lo que de verdad
 * hace falta: "endémica" o "CITES" no le dicen nada a todo el mundo.
 */
@Composable
private fun QueTeDice() {
    val puntos = listOf(
        Triple(
            Icons.Default.Spa,
            "Si es nativa de Colombia o exótica",
            "Nativa es la que crece aquí de forma natural. Exótica es la traída de otra " +
                "región o país, y algunas se vuelven invasoras.",
        ),
        Triple(
            Icons.Default.Public,
            "Si es endémica, es decir, si solo vive aquí",
            "Una especie endémica no existe de forma natural en ningún otro país. Si " +
                "desaparece de Colombia, desaparece del mundo.",
        ),
        Triple(
            Icons.Default.Shield,
            "Si se encuentra amenazada y, en ese caso, en qué categoría",
            "Según la Resolución 0126 de 2024: vulnerable (VU), en peligro (EN) o en " +
                "peligro crítico (CR). La mayoría de especies no está en ninguna.",
        ),
        Triple(
            Icons.Default.Gavel,
            "Si está en algún apéndice CITES, que regula su comercio internacional",
            "El apéndice II exige permiso de exportación; el I prohíbe el comercio salvo " +
                "casos excepcionales. Afecta a la madera que sale del país.",
        ),
        Triple(
            Icons.Default.Lock,
            "Si está vedada, por norma nacional o regional",
            "Una veda prohíbe o restringe el aprovechamiento. Se consultan las nacionales " +
                "y las de Corantioquia y Cornare.",
        ),
        Triple(
            Icons.Default.Place,
            "Cuál es su rango de distribución",
            "En qué departamentos vive, a qué altura y en qué región biogeográfica.",
        ),
    )

    var abierta by remember { mutableStateOf(-1) }

    TarjetaTitulada(Icons.Default.MenuBook, "Qué te dice esta app") {
        Text(
            "Escribe un nombre o toma una foto de una planta o un animal, y te responde:",
            color = TextoClaro,
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(8.dp))

        puntos.forEachIndexed { i, (icono, texto, explicacion) ->
            if (i > 0) Separador()
            FilaConIcono(
                icono = icono,
                texto = texto,
                apoyo = if (abierta == i) explicacion else null,
                onClick = { abierta = if (abierta == i) -1 else i },
            )
        }

        Spacer(Modifier.height(10.dp))
        NotaAlPie(
            Icons.Default.Info,
            "Los datos legales y de conservación salen de las listas oficiales colombianas " +
                "cargadas en el servidor, con su norma citada. El nombre que sale de una " +
                "foto lo propone la IA y puede equivocarse.",
        )
    }
}

@Composable
private fun Trabajando(mensaje: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(color = VerdeMarca)
        Spacer(Modifier.height(12.dp))
        Text(mensaje, color = TextoTenue, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun BarraDeVuelta(vm: BioViewModel) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (vm.puedeVolverALasCandidatas) {
            TextButton(onClick = vm::volverALasCandidatas) {
                Text("Volver a la lista", color = VerdeSuave)
            }
        }
        TextButton(onClick = vm::volverAlInicio) {
            Text("Nueva consulta", color = VerdeSuave)
        }
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
        aviso?.let {
            Text(it, color = TextoClaro, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        }
        nota?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = TextoTenue, style = MaterialTheme.typography.bodySmall)
        }

        candidatas.forEach { c ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(VerdePanel)
                    .border(1.dp, VerdeBorde, RoundedCornerShape(14.dp))
                    .clickable { onElegir(c) }
                    .padding(12.dp),
            ) {
                Text(
                    c.nombreCientifico ?: "",
                    color = TextoClaro,
                    style = MaterialTheme.typography.titleMedium,
                    fontStyle = FontStyle.Italic,
                    fontWeight = FontWeight.Bold,
                )
                listOfNotNull(c.familia, c.nombresComunes ?: c.nombreComun)
                    .filter { it.isNotBlank() }
                    .takeIf { it.isNotEmpty() }
                    ?.let {
                        Text(it.joinToString(" · "), color = TextoTenue, style = MaterialTheme.typography.bodySmall)
                    }
                c.dondeSeUsa?.takeIf { it.isNotBlank() }?.let {
                    Text("Se le llama así en: $it", color = TextoTenue, style = MaterialTheme.typography.bodySmall)
                }

                // Las banderas van aquí porque son justo lo que hace elegir una u otra.
                val banderas = buildList {
                    if (c.endemica == true) add("Endémica")
                    c.amenaza?.let { add(it) }
                    if (c.vedada == true) add("Vedada")
                    c.origen?.takeIf { it == "exotica" }?.let { add("Exótica") }
                }
                if (banderas.isNotEmpty()) {
                    Text(
                        banderas.joinToString(" · "),
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(top = 6.dp),
                    )
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
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(210.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.Black),
            )
        }

        if (id.esSerVivo == false) {
            Mensaje(
                "En la foto no se ve un ser vivo",
                id.limitaciones.orEmpty().joinToString("\n") { "· $it" },
                error = true,
            )
            return@Column
        }

        TarjetaDeIdentificacion(id)

        // Lo oficial va debajo del nombre propuesto: todo lo de abajo depende de que ese
        // nombre sea el correcto.
        e.oficial?.let { CuerpoDeFicha(it, vm) }

        if (e.alternativas.isNotEmpty()) AlternativasDeFoto(e.alternativas, vm)

        id.recomendacionesCaptura?.takeIf { it.isNotEmpty() }?.let { consejos ->
            TarjetaTitulada(Icons.Default.PhotoCamera, "Para afinar") {
                consejos.forEach {
                    Text("· $it", color = TextoClaro, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        Text(
            listOfNotNull(e.modelo?.let { "Modelo: $it" }, e.latenciaMs?.let { "${it / 1000.0} s" })
                .joinToString(" · "),
            color = TextoTenue,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
private fun TarjetaDeIdentificacion(id: Identificacion) {
    Card(
        colors = CardDefaults.cardColors(containerColor = VerdePanel),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("IDENTIFICACIÓN POR IA", color = TextoTenue, style = MaterialTheme.typography.labelSmall)
            Text(
                id.nombreComun?.takeIf { it != "desconocido" } ?: "Sin nombre común",
                color = TextoClaro,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                id.nombreCientifico ?: "",
                color = VerdeSuave,
                style = MaterialTheme.typography.titleMedium,
                fontStyle = FontStyle.Italic,
            )
            listOfNotNull(id.familia, id.tipoDeOrganismo, id.grupo)
                .filter { it.isNotBlank() }
                .takeIf { it.isNotEmpty() }
                ?.let { Text(it.joinToString(" · "), color = TextoTenue, style = MaterialTheme.typography.bodySmall) }

            Spacer(Modifier.height(12.dp))
            Confianza(id.confianza, id.nivelAlcanzado)

            id.caracteresObservados?.takeIf { it.isNotEmpty() }?.let { caracteres ->
                Spacer(Modifier.height(12.dp))
                Text("Lo que se ve en la foto", color = TextoClaro, fontWeight = FontWeight.Bold)
                caracteres.forEach {
                    Text("· $it", color = TextoClaro, style = MaterialTheme.typography.bodyMedium)
                }
            }
            id.habitat?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(10.dp))
                Text("Hábitat", color = TextoClaro, fontWeight = FontWeight.Bold)
                Text(it, color = TextoClaro, style = MaterialTheme.typography.bodyMedium)
            }
            id.historiaNatural?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(10.dp))
                Text("Cómo vive", color = TextoClaro, fontWeight = FontWeight.Bold)
                Text(it, color = TextoClaro, style = MaterialTheme.typography.bodyMedium)
            }
            id.limitaciones?.takeIf { it.isNotEmpty() }?.let { limites ->
                Spacer(Modifier.height(10.dp))
                Text("Límites de este análisis", color = TextoClaro, fontWeight = FontWeight.Bold)
                limites.forEach {
                    Text("· $it", color = TextoTenue, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

/**
 * La confianza, con su lectura en palabras.
 *
 * El número solo no dice nada a quien no trabaja con probabilidades, y en XiloScan se
 * aprendió que una confianza que siempre ronda el 0,9 acaba siendo ruido.
 */
@Composable
private fun Confianza(valor: Double?, nivel: String?) {
    val confianza = valor ?: 0.0
    val color = when {
        confianza >= 0.7 -> VerdeMarca
        confianza >= 0.5 -> Color(0xFFE0A33A)
        else -> Color(0xFFE5766B)
    }

    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                when {
                    confianza >= 0.7 -> "Identificación probable"
                    confianza >= 0.5 -> "Identificación posible, sin confirmar"
                    else -> "Solo una candidata: no está confirmada"
                },
                color = color,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
            )
            Text("${(confianza * 100).toInt()} %", color = color, fontWeight = FontWeight.Bold)
        }
        LinearProgressIndicator(
            progress = { confianza.toFloat().coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            color = color,
            trackColor = VerdePanelClaro,
        )
        nivel?.takeIf { it.isNotBlank() }?.let {
            Text(
                "Llega hasta el nivel de $it.",
                color = TextoTenue,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun AlternativasDeFoto(alternativas: List<Alternativa>, vm: BioViewModel) {
    TarjetaTitulada(Icons.Default.Search, "Otras posibilidades") {
        Text(
            "Toca una para ver su ficha oficial.",
            color = TextoTenue,
            style = MaterialTheme.typography.bodySmall,
        )
        Spacer(Modifier.height(8.dp))

        alternativas.forEach { alt ->
            val nombre = alt.nombreCientifico
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, VerdeBorde, RoundedCornerShape(12.dp))
                    .clickable(enabled = nombre != null) {
                        nombre?.let(vm::consultarNombreCientifico)
                    }
                    .padding(10.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(nombre ?: "", color = TextoClaro, fontStyle = FontStyle.Italic, fontWeight = FontWeight.Bold)
                    alt.confianza?.let { Text("${(it * 100).toInt()} %", color = TextoTenue) }
                }
                alt.nombreComun?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = TextoTenue, style = MaterialTheme.typography.bodySmall)
                }

                val banderas = buildList {
                    alt.oficial?.amenaza?.nacional?.categoria?.let { add(it) }
                    if (!alt.oficial?.veda?.detalle.isNullOrEmpty()) add("Vedada")
                    if (alt.oficial?.endemica?.valor == true) add("Endémica")
                }
                if (banderas.isNotEmpty()) {
                    Text(
                        banderas.joinToString(" · "),
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                alt.motivo?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = TextoTenue, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

/* ---------------------------------------------------------------------- mensajes */

@Composable
fun Mensaje(titulo: String, texto: String, codigo: String? = null, error: Boolean = false) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (error) MaterialTheme.colorScheme.errorContainer else VerdePanel,
                RoundedCornerShape(16.dp),
            )
            .padding(16.dp),
    ) {
        Text(titulo, color = TextoClaro, fontWeight = FontWeight.Bold)
        if (texto.isNotBlank()) {
            Text(texto, color = TextoClaro, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
        }
        codigo?.let {
            Text(it, color = TextoTenue, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 8.dp))
        }
    }
}
