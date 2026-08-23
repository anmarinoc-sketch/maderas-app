package com.bioscan.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bioscan.app.data.Ficha
import com.bioscan.app.data.Veda

/*
 * Como se pinta una ficha.
 *
 * La regla que manda sobre el resto: se tiene que ver de un vistazo que parte viene de
 * las listas oficiales y que parte la ha escrito el modelo. Van con estilos distintos y
 * la parte del modelo lleva su etiqueta encima. Mezclarlas seria dar el mismo peso a un
 * numero de resolucion verificado y a una frase bien redactada.
 */

/** Colores de las etiquetas de estado. No salen del tema porque su significado es fijo. */
private val RojoGrave = Color(0xFFB3261E)
private val NaranjaAviso = Color(0xFFB2670A)
private val VerdeBien = Color(0xFF2E6B52)
private val GrisNoConsta = Color(0xFF6F7B75)

@Composable
fun CuerpoDeFicha(ficha: Ficha, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Encabezado(ficha)
        Etiquetas(ficha)

        // La veda va lo primero porque es lo que puede meter en un lio a quien consulta.
        BloqueVedas(ficha)

        BloqueAmenaza(ficha)
        BloqueOrigen(ficha)
        BloqueDistribucion(ficha)
        BloqueRelato(ficha)
        BloqueFuentes(ficha)
    }
}

/* ------------------------------------------------------------------- encabezado */

@Composable
private fun Encabezado(ficha: Ficha) {
    Column {
        Text(
            text = ficha.nombreCientifico ?: "Especie sin nombre",
            style = MaterialTheme.typography.headlineSmall,
            fontStyle = FontStyle.Italic,
            fontWeight = FontWeight.Bold,
        )
        ficha.autoria?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = GrisNoConsta)
        }

        val taxonomia = listOfNotNull(ficha.familia, ficha.clase, ficha.reino)
            .distinct()
            .joinToString(" · ")
        if (taxonomia.isNotBlank()) {
            Text(
                taxonomia,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }

        ficha.nombresComunes?.takeIf { it.isNotBlank() }?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        if (!ficha.estaEnAlgunaLista) {
            Aviso(
                "Esta especie no aparece en ninguna de las listas oficiales cargadas. " +
                    "Todo lo que sigue viene del modelo y no está verificado.",
                NaranjaAviso,
                Modifier.padding(top = 8.dp),
            )
        }
    }
}

/* -------------------------------------------------------------------- etiquetas */

@Composable
private fun Etiquetas(ficha: Ficha) {
    val etiquetas = buildList {
        when (ficha.origen?.valor) {
            "nativa" -> add(Etiqueta("Nativa", VerdeBien))
            "exotica" -> add(Etiqueta("Exótica", NaranjaAviso))
            else -> add(Etiqueta("Origen no consta", GrisNoConsta))
        }

        when (ficha.endemica?.valor) {
            true -> add(Etiqueta("Endémica de Colombia", VerdeBien))
            false -> Unit // No endemica no es noticia: no gasta espacio.
            null -> Unit
        }

        ficha.amenaza?.nacional?.categoria?.let {
            add(Etiqueta(nombreDeCategoria(it), if (it == "VU") NaranjaAviso else RojoGrave))
        }

        if (!ficha.vedas.isNullOrEmpty()) add(Etiqueta("Vedada", RojoGrave))

        ficha.cites?.apendice?.let { add(Etiqueta("CITES $it", NaranjaAviso)) }

        ficha.origen?.invasividad?.takeIf { it.isNotBlank() }?.let {
            add(Etiqueta("Con potencial invasor", RojoGrave))
        }
    }

    FilaDeEtiquetas(etiquetas)
}

private data class Etiqueta(val texto: String, val color: Color)

@Composable
private fun FilaDeEtiquetas(etiquetas: List<Etiqueta>) {
    // Se reparten en filas de dos a mano: FlowRow sigue siendo experimental y no merece
    // arrastrar una anotacion de opt-in por colocar cuatro pastillas.
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        etiquetas.chunked(2).forEach { pareja ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                pareja.forEach { Pastilla(it.texto, it.color) }
            }
        }
    }
}

@Composable
private fun Pastilla(texto: String, color: Color) {
    Text(
        text = texto,
        style = MaterialTheme.typography.labelLarge,
        color = Color.White,
        modifier = Modifier
            .background(color, RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 5.dp),
    )
}

private fun nombreDeCategoria(codigo: String) = when (codigo) {
    "CR" -> "En peligro crítico"
    "EN" -> "En peligro"
    "VU" -> "Vulnerable"
    else -> codigo
}

/* ------------------------------------------------------------------------ vedas */

@Composable
private fun BloqueVedas(ficha: Ficha) {
    val vedas = ficha.vedas.orEmpty()
    val cobertura = ficha.coberturaVedas

    Seccion("Veda", oficial = true) {
        if (vedas.isEmpty()) {
            Text(
                "No figura en ninguna de las normas de veda cargadas.",
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                vedas.forEach { TarjetaDeVeda(it) }
            }
        }

        // Este aviso va SIEMPRE, haya veda o no. Es la diferencia entre "no esta vedada"
        // y "no me consta que lo este", y es justo donde una app puede hacer daño.
        cobertura?.advertencia?.let {
            Aviso(it, NaranjaAviso, Modifier.padding(top = 10.dp))
        }

        cobertura?.listadosIncompletos?.takeIf { it.isNotEmpty() }?.let { incompletos ->
            Text(
                "Listados incompletos en la app: " + incompletos.joinToString("; "),
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun TarjetaDeVeda(veda: Veda) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, RojoGrave.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
            .padding(10.dp),
    ) {
        Text(
            veda.norma ?: "Norma sin identificar",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
        )
        veda.autoridad?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = GrisNoConsta)
        }
        veda.territorio?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        veda.efecto?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
        }

        veda.excepciones?.let {
            Column(modifier = Modifier.padding(top = 8.dp)) {
                Text(
                    "Excepciones",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
        }

        // Que la veda alcance por familia o por genero, y no por el nombre de la especie,
        // cambia como de firme es la conclusion: conviene que se vea.
        veda.coincidePor?.takeIf { it.isNotEmpty() }?.let { caminos ->
            val porQue = caminos.joinToString(" y ") { camino ->
                when (camino) {
                    "especie" -> "está nombrada en la norma"
                    "genero" -> "su género está nombrado en la norma"
                    "familia" -> "su familia está nombrada en la norma"
                    "grupo" -> "pertenece a un grupo vedado (musgos, líquenes…)"
                    else -> camino
                }
            }
            Text(
                "Aplica porque $porQue.",
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        if (veda.listadoIncompleto == true) {
            Aviso(
                "El listado de esta norma está incompleto en la app: confirma en la fuente.",
                NaranjaAviso,
                Modifier.padding(top = 8.dp),
            )
        }
    }
}

/* ---------------------------------------------------------------------- amenaza */

@Composable
private fun BloqueAmenaza(ficha: Ficha) {
    val amenaza = ficha.amenaza ?: return

    Seccion("Categoría de amenaza", oficial = true) {
        val nacional = amenaza.nacional
        if (nacional?.categoria != null) {
            Text(
                "${nombreDeCategoria(nacional.categoria)} (${nacional.categoria})",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = if (nacional.categoria == "VU") NaranjaAviso else RojoGrave,
            )
            nacional.significado?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
            }
            Text(
                listOfNotNull(nacional.norma, nacional.autoridad).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
                modifier = Modifier.padding(top = 6.dp),
            )
        } else {
            Text(
                amenaza.sinCategoria ?: "No figura entre las especies amenazadas.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        // La lectura del Catalogo puede no coincidir con la norma vigente. Cuando difieren,
        // enseñar las dos es mas honesto que elegir una en silencio.
        amenaza.catalogo?.categoria?.takeIf { it != nacional?.categoria }?.let {
            Text(
                "El Catálogo de Plantas de Colombia la clasifica como $it.",
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        ficha.cites?.let { cites ->
            HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
            Text("CITES · Apéndice ${cites.apendice}", fontWeight = FontWeight.Bold)
            cites.significado?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
            }
            cites.advertencia?.let { Aviso(it, NaranjaAviso, Modifier.padding(top = 8.dp)) }
        }
    }
}

/* ----------------------------------------------------------------------- origen */

@Composable
private fun BloqueOrigen(ficha: Ficha) {
    val origen = ficha.origen ?: return

    Seccion("Origen y endemismo", oficial = true) {
        Text(
            when (origen.valor) {
                "nativa" -> "Nativa de Colombia"
                "exotica" -> "Exótica: no es originaria de Colombia"
                else -> "No consta si es nativa o exótica"
            },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )

        origen.detalle?.takeIf { it.isNotBlank() }?.let {
            Text("Estatus: $it", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
        }
        origen.origenGeografico?.takeIf { it.isNotBlank() }?.let {
            Text("Procede de: $it", style = MaterialTheme.typography.bodyMedium)
        }
        origen.invasividad?.takeIf { it.isNotBlank() }?.let {
            Aviso("Potencial invasor: $it", RojoGrave, Modifier.padding(top = 8.dp))
        }
        origen.nota?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = GrisNoConsta, modifier = Modifier.padding(top = 6.dp))
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))

        val endemica = ficha.endemica
        Text(
            when (endemica?.valor) {
                true -> "Endémica de Colombia"
                false -> "No es endémica: también vive fuera de Colombia"
                null -> "El endemismo no consta"
            },
            fontWeight = FontWeight.Bold,
        )
        endemica?.nota?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

/* ----------------------------------------------------------------- distribucion */

@Composable
private fun BloqueDistribucion(ficha: Ficha) {
    val d = ficha.distribucion ?: return
    val hayAlgo = listOfNotNull(d.departamentos, d.altitud, d.regiones, d.global).any { it.isNotBlank() }
    if (!hayAlgo) return

    Seccion("Rango de distribución", oficial = true) {
        d.global?.takeIf { it.isNotBlank() }?.let { Dato("Distribución global", it) }
        d.regiones?.takeIf { it.isNotBlank() }?.let { Dato("Región biogeográfica", it) }
        d.altitud?.takeIf { it.isNotBlank() }?.let { Dato("Altitud", it) }
        d.departamentos?.takeIf { it.isNotBlank() }?.let { Dato("Departamentos", it) }
    }
}

@Composable
private fun Dato(titulo: String, valor: String) {
    Column(modifier = Modifier.padding(bottom = 8.dp)) {
        Text(titulo, style = MaterialTheme.typography.labelLarge, color = GrisNoConsta)
        Text(valor, style = MaterialTheme.typography.bodyMedium)
    }
}

/* ----------------------------------------------------------------------- relato */

@Composable
private fun BloqueRelato(ficha: Ficha) {
    val relato = ficha.relato

    if (relato == null) {
        ficha.relatoNoDisponible?.let {
            Seccion("Explicación", oficial = false) {
                Text(
                    "No se pudo redactar: $it",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "Los datos oficiales de arriba no dependen de esto y siguen siendo válidos.",
                    style = MaterialTheme.typography.bodySmall,
                    color = GrisNoConsta,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
        return
    }

    Seccion("Explicación", oficial = false) {
        relato.queEs?.let { Parrafo("Qué es", it) }
        relato.dondeVive?.let { Parrafo("Dónde vive", it) }
        relato.comoReconocerla?.let { Parrafo("Cómo reconocerla", it) }
        relato.importanciaConservacion?.let { Parrafo("Por qué importa conservarla", it) }
        relato.enLaPractica?.let { Parrafo("En la práctica", it) }
    }
}

@Composable
private fun Parrafo(titulo: String, texto: String) {
    Column(modifier = Modifier.padding(bottom = 10.dp)) {
        Text(titulo, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        Text(texto, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 2.dp))
    }
}

/* ---------------------------------------------------------------------- fuentes */

@Composable
private fun BloqueFuentes(ficha: Ficha) {
    val fuentes = ficha.fuentes.orEmpty().filter { it.isNotBlank() }
    if (fuentes.isEmpty()) return

    Column(modifier = Modifier.padding(top = 4.dp)) {
        Text("Fuentes", style = MaterialTheme.typography.labelLarge, color = GrisNoConsta)
        fuentes.forEach {
            Text("· $it", style = MaterialTheme.typography.bodySmall, color = GrisNoConsta)
        }
        Text(
            "Esta app no sustituye la consulta a la autoridad ambiental. Antes de " +
                "cualquier trámite, verifica la norma vigente.",
            style = MaterialTheme.typography.bodySmall,
            color = GrisNoConsta,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

/* -------------------------------------------------------------- piezas comunes */

/**
 * Una seccion de la ficha.
 *
 * `oficial` decide el aspecto y la etiqueta. Es el mecanismo que impide que el relato
 * del modelo se confunda con un dato verificado: van en tarjetas distintas y lo dicen.
 */
@Composable
private fun Seccion(titulo: String, oficial: Boolean, contenido: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (oficial) {
                MaterialTheme.colorScheme.surface
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (oficial) 2.dp else 0.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(titulo, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    if (oficial) "Lista oficial" else "Redactado por IA",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White,
                    modifier = Modifier
                        .background(
                            if (oficial) VerdeBien else GrisNoConsta,
                            RoundedCornerShape(50),
                        )
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
            Column(modifier = Modifier.padding(top = 10.dp)) { contenido() }
        }
    }
}

@Composable
private fun Aviso(texto: String, color: Color, modifier: Modifier = Modifier) {
    Text(
        text = texto,
        style = MaterialTheme.typography.bodySmall,
        color = color,
        modifier = modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.10f), RoundedCornerShape(6.dp))
            .padding(8.dp),
    )
}
