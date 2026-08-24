package com.bioscan.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.bioscan.app.ui.theme.TextoClaro
import com.bioscan.app.ui.theme.TextoTenue
import com.bioscan.app.ui.theme.VerdeBorde
import com.bioscan.app.ui.theme.VerdeMarca
import com.bioscan.app.ui.theme.VerdePanel
import com.bioscan.app.ui.theme.VerdePanelClaro
import com.bioscan.app.util.Guardada
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/*
 * Historial y favoritos.
 *
 * Las dos listas se guardan en el propio telefono, no en el servidor: el disco de Render
 * se borra en cada despliegue y no hay cuentas de usuario. Ver util/Guardados.kt.
 */

@Composable
fun PantallaHistorial(vm: BioViewModel, onAbrir: (String) -> Unit) {
    val lista by vm.historial.collectAsStateWithLifecycle()

    ListaDeGuardadas(
        titulo = "Historial",
        subtitulo = if (lista.isEmpty()) null else "Las últimas ${lista.size} especies que consultaste",
        icono = Icons.Default.History,
        lista = lista,
        vacio = "Aquí van apareciendo las especies que consultes. Todavía no hay ninguna.",
        onAbrir = onAbrir,
        accion = if (lista.isEmpty()) null else "Borrar historial" to vm::borrarHistorial,
    )
}

@Composable
fun PantallaFavoritos(vm: BioViewModel, onAbrir: (String) -> Unit) {
    val lista by vm.favoritos.collectAsStateWithLifecycle()

    ListaDeGuardadas(
        titulo = "Favoritos",
        subtitulo = if (lista.isEmpty()) null else "${lista.size} especies guardadas",
        icono = Icons.Default.Favorite,
        lista = lista,
        vacio = "Marca una especie con el corazón desde su ficha y aparecerá aquí, " +
            "lista para consultarla sin volver a buscarla.",
        onAbrir = onAbrir,
        onQuitar = vm::quitarFavorita,
    )
}

@Composable
private fun ListaDeGuardadas(
    titulo: String,
    subtitulo: String?,
    icono: ImageVector,
    lista: List<Guardada>,
    vacio: String,
    onAbrir: (String) -> Unit,
    onQuitar: ((String) -> Unit)? = null,
    accion: Pair<String, () -> Unit>? = null,
) {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconoRedondo(icono, tamano = 46)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(titulo, color = TextoClaro, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                subtitulo?.let {
                    Text(it, color = TextoTenue, style = MaterialTheme.typography.bodySmall)
                }
            }
            accion?.let { (etiqueta, alPulsar) ->
                TextButton(onClick = alPulsar) { Text(etiqueta, color = TextoTenue) }
            }
        }

        if (lista.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                Text(
                    vacio,
                    color = TextoTenue,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 40.dp, start = 8.dp, end = 8.dp),
                )
            }
            return@Column
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            items(lista, key = { it.nombreCientifico }) { g ->
                FilaDeGuardada(g, onAbrir = { onAbrir(g.nombreCientifico) }, onQuitar = onQuitar)
            }
        }
    }
}

@Composable
private fun FilaDeGuardada(
    g: Guardada,
    onAbrir: () -> Unit,
    onQuitar: ((String) -> Unit)?,
) {
    val forma = RoundedCornerShape(16.dp)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(forma)
            .background(VerdePanel)
            .border(1.dp, VerdeBorde, forma)
            .clickable(onClick = onAbrir)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // La miniatura es lo que hace reconocible una lista larga de nombres en latin.
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(VerdePanelClaro),
            contentAlignment = Alignment.Center,
        ) {
            if (g.fotoUrl != null) {
                AsyncImage(
                    model = g.fotoUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Icon(Icons.Default.Favorite, contentDescription = null, tint = VerdeBorde)
            }
        }

        Spacer(Modifier.width(12.dp))

        Column(Modifier.weight(1f)) {
            g.nombreComun?.takeIf { it.isNotBlank() }?.let {
                Text(it, color = TextoClaro, fontWeight = FontWeight.Bold)
            }
            Text(
                g.nombreCientifico,
                color = if (g.nombreComun.isNullOrBlank()) TextoClaro else TextoTenue,
                fontStyle = FontStyle.Italic,
                style = MaterialTheme.typography.bodySmall,
            )

            val banderas = buildList {
                if (g.endemica) add("Endémica")
                g.amenaza?.let { add(it) }
                if (g.vedada) add("Vedada")
            }
            if (banderas.isNotEmpty()) {
                Text(
                    banderas.joinToString(" · "),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelSmall,
                )
            } else {
                Text(fecha(g.cuando), color = TextoTenue, style = MaterialTheme.typography.labelSmall)
            }
        }

        onQuitar?.let {
            IconButton(onClick = { it(g.nombreCientifico) }) {
                Icon(Icons.Default.Delete, contentDescription = "Quitar", tint = TextoTenue)
            }
        }
    }
}

/** Fecha corta, en el idioma del proyecto y no en el del teléfono. */
private fun fecha(instante: Long): String =
    SimpleDateFormat("d 'de' MMMM, HH:mm", Locale("es", "CO")).format(Date(instante))

/* ------------------------------------------------------------------------- más */

@Composable
fun PantallaMas(onAjustes: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(Modifier.height(20.dp))

        Text("Más", color = TextoClaro, fontSize = 24.sp, fontWeight = FontWeight.Bold)

        TarjetaTitulada(Icons.Default.History, "De dónde salen los datos") {
            listOf(
                "Resolución 0126 de 2024 (Minambiente): categorías de amenaza de flora y fauna.",
                "Catálogo de Plantas y Líquenes de Colombia: origen, endemismo, distribución.",
                "Listas de aves, mamíferos y peces de SiB Colombia.",
                "GBIF: taxonomía, nombres comunes y categoría mundial de la UICN.",
                "Vedas nacionales, de Corantioquia y de Cornare, transcritas de las normas.",
                "CITES: apéndices, con las inclusiones hasta noviembre de 2024.",
            ).forEach {
                Text("· $it", color = TextoClaro, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(6.dp))
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "Esta app no sustituye la consulta a la autoridad ambiental. Antes de " +
                    "cualquier trámite, verifica la norma vigente.",
                color = VerdeMarca,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(VerdePanel)
                .border(1.dp, VerdeBorde, RoundedCornerShape(16.dp))
                .clickable(onClick = onAjustes)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Ajustes", color = TextoClaro, fontWeight = FontWeight.Bold)
                Text(
                    "Servidor, clave y explicación redactada",
                    color = TextoTenue,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text("›", color = TextoTenue, fontSize = 24.sp)
        }

        Text(
            "BioScan ${com.bioscan.app.BuildConfig.VERSION_NAME}",
            color = TextoTenue,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

