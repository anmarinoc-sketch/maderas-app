package com.bioscan.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.bioscan.app.data.Ficha
import com.bioscan.app.data.Veda
import com.bioscan.app.data.VedaPorAutoridad

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
    // La veda es cosa de flora. Ante un animal no se enseña el apartado, ni la fila del
    // resumen, ni una explicacion de por que no aplica: el usuario ya sabe que es un
    // animal, y un bloque entero diciendo "esto no viene al caso" solo estorba.
    val esFauna = ficha.veda?.aplica == false

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        FotoDeLaEspecie(ficha)
        Encabezado(ficha, tieneFoto = !ficha.foto?.url.isNullOrBlank())
        Etiquetas(ficha, esFauna)
        ResumenRapido(ficha, esFauna)

        // Lo primero de todo cuando aplica: es lo que puede meter en un lio a quien consulta.
        if (!esFauna) BloqueVedas(ficha)

        BloqueAmenaza(ficha)
        BloqueOrigen(ficha)
        BloqueDistribucion(ficha)
        BloqueRelato(ficha)
        BloqueFuentes(ficha)
    }
}

/* ------------------------------------------------------------------------ foto */

/**
 * Fotografía de la especie, de Wikipedia.
 *
 * No es un dato oficial y no pretende serlo: sirve para que quien tiene la planta o el
 * animal delante compare de un vistazo y se dé cuenta enseguida si la app se equivocó de
 * especie. Por eso lleva la fuente encima y no se presenta como prueba de nada.
 */
@Composable
private fun FotoDeLaEspecie(ficha: Ficha) {
    // En una variable local: el smart-cast sobre una propiedad de otra clase es fragil y
    // aqui no hay forma de compilar para comprobarlo.
    val foto = ficha.foto
    val url = foto?.url
    if (url.isNullOrBlank()) return

    val credito = foto.fuente ?: "Wikipedia"

    Column {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(250.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF0E1A15)),
        ) {
            AsyncImage(
                model = url,
                contentDescription = "Fotografía de ${ficha.nombreCientifico}",
                // Fit y no Crop: recortando, a un ave le cortaba la cabeza y a un arbol
                // la copa. Lo que hay que ver es el bicho entero, aunque queden franjas.
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )

            // Velo degradado abajo, para que el nombre se lea sobre cualquier foto.
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(92.dp)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color(0xE60B1712)),
                        )
                    ),
            )

            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                ficha.nombresComunes?.split("|")?.firstOrNull()?.trim()
                    ?.takeIf { it.isNotBlank() }
                    ?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                    }
                Text(
                    ficha.nombreCientifico ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    fontStyle = FontStyle.Italic,
                    color = Color(0xFFB7E4C7),
                )
            }
        }
        Text(
            "Foto de referencia · $credito",
            style = MaterialTheme.typography.labelSmall,
            color = GrisNoConsta,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

/* -------------------------------------------------------------- resumen rapido */

/**
 * Las cuatro preguntas, con su sí o su no.
 *
 * Es la forma en que se consulta de verdad en campo: no se lee la ficha entera, se mira
 * si está vedada y se sigue trabajando. Todo lo de abajo desarrolla estas cuatro líneas.
 */
@Composable
private fun ResumenRapido(ficha: Ficha, esFauna: Boolean) {
    val vedaAplica = ficha.veda?.aplica
    val vedada = ficha.veda?.detalle?.isNotEmpty() == true || !ficha.vedas.isNullOrEmpty()

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Pregunta(
                "¿Es nativa o exótica?",
                when (ficha.origen?.valor) {
                    "nativa" -> "Nativa"
                    "exotica" -> "Exótica"
                    else -> "No consta"
                },
                when (ficha.origen?.valor) {
                    "nativa" -> VerdeBien
                    "exotica" -> NaranjaAviso
                    else -> GrisNoConsta
                },
            )
            Pregunta(
                "¿Es endémica?",
                ficha.endemica?.categoria ?: when (ficha.endemica?.valor) {
                    true -> "Sí"
                    false -> "No"
                    null -> "No consta"
                },
                if (ficha.endemica?.valor == true) VerdeBien else GrisNoConsta,
            )
            // "¿Está amenazada?" y no "¿en qué categoría?": la mayoría de las especies no
            // figuran en ninguna, y eso es una respuesta, no un hueco.
            Pregunta(
                "¿Está amenazada?",
                ficha.amenaza?.nacional?.categoria?.let { "Sí · ${nombreDeCategoria(it)}" }
                    ?: "No figura",
                ficha.amenaza?.nacional?.categoria?.let {
                    if (it == "VU") NaranjaAviso else RojoGrave
                } ?: VerdeBien,
            )
            Pregunta(
                "¿Está en CITES?",
                ficha.cites?.apendice?.let { "Sí · Apéndice $it" } ?: "No figura",
                if (ficha.cites?.apendice != null) NaranjaAviso else VerdeBien,
            )
            if (!esFauna) {
                Pregunta(
                    "¿Está vedada?",
                    when {
                        vedada -> "Sí"
                        vedaAplica == null -> "Sin determinar"
                        else -> "No"
                    },
                    when {
                        vedada -> RojoGrave
                        vedaAplica == null -> GrisNoConsta
                        else -> VerdeBien
                    },
                )
            }
        }
    }
}

@Composable
private fun Pregunta(pregunta: String, respuesta: String, color: Color) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(pregunta, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(
            respuesta,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = color,
        )
    }
}

/* ------------------------------------------------------------------- encabezado */

@Composable
private fun Encabezado(ficha: Ficha, tieneFoto: Boolean) {
    Column {
        // Con foto, el nombre ya va encima de ella: repetirlo aqui solo gasta pantalla.
        if (!tieneFoto) {
            Text(
                text = ficha.nombreCientifico ?: "Especie sin nombre",
                style = MaterialTheme.typography.headlineSmall,
                fontStyle = FontStyle.Italic,
                fontWeight = FontWeight.Bold,
            )
        }
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
    }
}

/* -------------------------------------------------------------------- etiquetas */

@Composable
private fun Etiquetas(ficha: Ficha, esFauna: Boolean) {
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

        if (!esFauna && !ficha.vedas.isNullOrEmpty()) add(Etiqueta("Vedada", RojoGrave))

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
    // Solo se llama para flora: quien decide es CuerpoDeFicha. Ante un animal el apartado
    // no se pinta en absoluto, ni siquiera para decir que no aplica.
    val veda = ficha.veda
    val porAutoridad = veda?.porAutoridad.orEmpty()
    val detalle = veda?.detalle ?: ficha.vedas.orEmpty()

    Seccion("Veda", oficial = true, acento = if (detalle.isNotEmpty()) RojoGrave else VerdeBien) {
        if (porAutoridad.isEmpty()) {
            // Servidor antiguo: se pinta como antes.
            Text(
                if (detalle.isEmpty()) "No figura en ninguna de las normas de veda cargadas."
                else "Figura en las normas de abajo.",
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            porAutoridad.forEach { FilaDeAutoridad(it) }
        }

        veda?.motivo?.let { Aviso(it, NaranjaAviso, Modifier.padding(top = 10.dp)) }

        // Justo debajo del cuadro de autoridades: es ahi donde alguien lee "sin veda" y
        // se va tranquilo de una especie que en realidad esta en peligro.
        veda?.notaAmenazada?.let { Aviso(it, NaranjaAviso, Modifier.padding(top = 10.dp)) }

        if (detalle.isNotEmpty()) {
            Column(
                modifier = Modifier.padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                detalle.forEach { TarjetaDeVeda(it) }
            }
        }
    }
}

/**
 * Una línea por autoridad, con su veredicto a la derecha.
 *
 * Responde la pregunta tal como se hace delante del árbol: ¿tengo veda nacional?
 * ¿y regional, de quién? El aviso de listado incompleto va pegado a la autoridad que
 * lo tiene, no como un miedo general sobre todo el apartado.
 */
@Composable
private fun FilaDeAutoridad(a: VedaPorAutoridad) {
    val vedada = a.vedada == true
    val incompleto = a.listadoCompleto == false

    val (texto, color) = when {
        vedada -> "VEDADA" to RojoGrave
        incompleto -> "Sin veda registrada" to NaranjaAviso
        else -> "Sin veda" to VerdeBien
    }

    Column(modifier = Modifier.padding(vertical = 5.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                a.autoridad ?: "",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            Text(
                texto,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = color,
            )
        }

        a.normas?.takeIf { it.isNotEmpty() }?.let {
            Text(
                it.joinToString("; "),
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
            )
        }
        if (incompleto) {
            a.aviso?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = NaranjaAviso,
                )
            }
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

    val grave = amenaza.nacional?.categoria != null
    Seccion(
        "Categoría de amenaza",
        oficial = true,
        acento = if (grave) RojoGrave else VerdeBien,
    ) {
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

            // Cuando la resolucion categoriza cada subespecie por separado, arriba se
            // enseña la PEOR. Sin este desglose, alguien con la subespecie menos
            // amenazada leeria una categoria que no es la suya, y al reves.
            nacional.desglose?.takeIf { it.isNotEmpty() }?.let { desglose ->
                nacional.notaDesglose?.let {
                    Aviso(it, NaranjaAviso, Modifier.padding(top = 8.dp))
                }
                Column(modifier = Modifier.padding(top = 6.dp)) {
                    desglose.forEach { sub ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                sub.nombre ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                fontStyle = FontStyle.Italic,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                sub.categoria ?: "",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = if (sub.categoria == "VU") NaranjaAviso else RojoGrave,
                            )
                        }
                    }
                }
            }
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

        // La categoria global de la UICN y la nacional no siempre coinciden: el roble es
        // Preocupacion Menor en el mundo y Vulnerable en Colombia. Manda la nacional,
        // que es la que tiene efecto legal aqui, pero ocultar la otra da una idea falsa.
        amenaza.global?.categoria?.let { global ->
            HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("A nivel mundial", fontWeight = FontWeight.Bold)
                Text(
                    global + (amenaza.global.codigo?.let { " ($it)" } ?: ""),
                    fontWeight = FontWeight.Bold,
                    color = if (amenaza.global.amenazada == true) RojoGrave else VerdeBien,
                )
            }
            Text(
                amenaza.global.fuente ?: "Lista Roja de la UICN",
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
            )
            if (nacional?.categoria != null && amenaza.global.amenazada != true) {
                Text(
                    "En Colombia está en una categoría más grave que en el resto del mundo. " +
                        "Aquí manda la nacional.",
                    style = MaterialTheme.typography.bodySmall,
                    color = NaranjaAviso,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }

        ficha.cites?.let { cites ->
            HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
            Text(
                "CITES · Apéndice ${cites.apendice}",
                fontWeight = FontWeight.Bold,
                color = NaranjaAviso,
            )
            cites.significado?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
            }
            // El alcance y la anotacion deciden si te aplica de verdad: la inclusion suele
            // ser de genero entero y cubrir solo unos productos concretos.
            cites.alcance?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
            }
            cites.anotacion?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
            }
            listOfNotNull(
                cites.desde?.let { "En vigor desde el $it" },
                cites.reunion,
            ).takeIf { it.isNotEmpty() }?.let {
                Text(
                    it.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = GrisNoConsta,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            cites.advertencia?.let { Aviso(it, NaranjaAviso, Modifier.padding(top = 8.dp)) }
        }
    }
}

/* ----------------------------------------------------------------------- origen */

@Composable
private fun BloqueOrigen(ficha: Ficha) {
    val origen = ficha.origen ?: return

    Seccion("Origen y endemismo", oficial = true, acento = Color(0xFF2E7D9A)) {
        Text(
            when (origen.valor) {
                "nativa" -> "Nativa de Colombia"
                "exotica" -> "Exótica: no es originaria de Colombia"
                else -> "No consta si es nativa o exótica"
            },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )

        // Cuando la respuesta la da el modelo y no una lista, hay que decirlo aquí mismo:
        // el bloque va etiquetado como "Lista oficial" y sin esta línea el dato pasaría
        // por verificado sin serlo.
        if (origen.segunElModelo == true) {
            Aviso(
                "Este dato no sale de las listas oficiales: lo propone la IA y no está " +
                    "verificado.",
                NaranjaAviso,
                Modifier.padding(top = 6.dp),
            )
        }

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
            // La categoría de la lista de aves ("Casi endémica") dice más que un sí o un
            // no, así que cuando viene se usa tal cual.
            endemica?.categoria ?: when (endemica?.valor) {
                true -> "Endémica de Colombia"
                false -> "No es endémica: también vive fuera de Colombia"
                null -> "El endemismo no consta"
            },
            fontWeight = FontWeight.Bold,
        )
        endemica?.nota?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
        }
        endemica?.donde?.takeIf { it.isNotBlank() }?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = GrisNoConsta,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

/* ----------------------------------------------------------------- distribucion */

@Composable
private fun BloqueDistribucion(ficha: Ficha) {
    val d = ficha.distribucion ?: return
    val hayAlgo = listOfNotNull(d.departamentos, d.altitud, d.regiones, d.global).any { it.isNotBlank() }
    if (!hayAlgo) return

    Seccion("Rango de distribución", oficial = true, acento = Color(0xFF7A6BB5)) {
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
            Seccion("Explicación", oficial = false, acento = GrisNoConsta) {
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

    Seccion("Explicación", oficial = false, acento = GrisNoConsta) {
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
private fun Seccion(
    titulo: String,
    oficial: Boolean,
    acento: Color = VerdeBien,
    contenido: @Composable () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (oficial) {
                MaterialTheme.colorScheme.surface
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (oficial) 3.dp else 0.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            // Banda de color a la izquierda: da relieve sin recargar, y de paso codifica
            // la gravedad del apartado. Sin ella todas las tarjetas se veian iguales y la
            // ficha quedaba plana.
            Box(
                modifier = Modifier
                    .width(5.dp)
                    .fillMaxHeight()
                    .background(acento),
            )
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        titulo.uppercase(),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = acento,
                    )
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
