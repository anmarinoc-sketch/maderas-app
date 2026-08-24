package com.bioscan.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bioscan.app.ui.theme.TextoClaro
import com.bioscan.app.ui.theme.TextoTenue
import com.bioscan.app.ui.theme.VerdeBorde
import com.bioscan.app.ui.theme.VerdeMarca
import com.bioscan.app.ui.theme.VerdePanel
import com.bioscan.app.ui.theme.VerdePanelClaro

/*
 * Piezas que se repiten por toda la app.
 *
 * Estan aparte para que las pantallas no se llenen de decoracion y para que un cambio de
 * estilo se haga en un sitio. La ficha tiene las suyas propias porque alli el color
 * codifica gravedad y no jerarquia.
 */

/** Icono dentro de un circulo, como en toda la maqueta. */
@Composable
fun IconoRedondo(
    icono: ImageVector,
    modifier: Modifier = Modifier,
    tamano: Int = 44,
    color: Color = VerdeMarca,
    fondo: Color = VerdePanelClaro,
) {
    Box(
        modifier = modifier.size(tamano.dp).background(fondo, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icono, contentDescription = null, tint = color, modifier = Modifier.size((tamano * 0.5).dp))
    }
}

/**
 * Tarjeta de accion grande: icono, titulo y una linea de apoyo.
 *
 * `destacada` la pinta con degradado y es la accion que se espera que se pulse. Solo una
 * por pantalla: si se destacan dos, no se destaca ninguna.
 */
@Composable
fun TarjetaAccion(
    icono: ImageVector,
    titulo: String,
    apoyo: String,
    destacada: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val forma = RoundedCornerShape(18.dp)

    Box(
        modifier = modifier
            .clip(forma)
            .then(
                if (destacada) {
                    Modifier.background(
                        Brush.linearGradient(listOf(Color(0xFF3FA05F), Color(0xFF2A6B41))),
                        forma,
                    )
                } else {
                    Modifier
                        .background(VerdePanel, forma)
                        .border(1.dp, VerdeBorde, forma)
                }
            )
            .clickable(onClick = onClick)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconoRedondo(
                icono,
                tamano = 46,
                color = if (destacada) Color.White else VerdeMarca,
                fondo = if (destacada) Color(0x33FFFFFF) else VerdePanelClaro,
            )
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    titulo,
                    color = if (destacada) Color.White else TextoClaro,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    apoyo,
                    color = if (destacada) Color(0xFFDFF3E6) else TextoTenue,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

/**
 * Fila con icono, texto y flecha.
 *
 * La flecha solo se pinta si la fila hace algo al tocarla. Una flecha que no lleva a
 * ninguna parte promete una pantalla que no existe.
 */
@Composable
fun FilaConIcono(
    icono: ImageVector,
    texto: String,
    modifier: Modifier = Modifier,
    apoyo: String? = null,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconoRedondo(icono, tamano = 38)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(texto, color = TextoClaro, style = MaterialTheme.typography.bodyMedium)
            apoyo?.let {
                Text(it, color = TextoTenue, style = MaterialTheme.typography.bodySmall)
            }
        }
        if (onClick != null) {
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TextoTenue,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}

/** Separador finísimo entre filas. */
@Composable
fun Separador() {
    Box(
        Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(VerdeBorde.copy(alpha = 0.5f))
    )
}

/** Tarjeta con título, su subrayado de acento y contenido libre. */
@Composable
fun TarjetaTitulada(
    icono: ImageVector,
    titulo: String,
    modifier: Modifier = Modifier,
    contenido: @Composable () -> Unit,
) {
    val forma = RoundedCornerShape(20.dp)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(VerdePanel.copy(alpha = 0.75f), forma)
            .border(1.dp, VerdeBorde.copy(alpha = 0.7f), forma)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconoRedondo(icono, tamano = 46)
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    titulo,
                    color = TextoClaro,
                    fontSize = 21.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(5.dp))
                // Subrayado corto bajo el titulo: es lo que da el aire de la maqueta.
                Box(
                    Modifier
                        .width(110.dp)
                        .height(3.dp)
                        .background(VerdeMarca, RoundedCornerShape(2.dp))
                )
            }
        }
        Spacer(Modifier.height(14.dp))
        contenido()
    }
}

/** Aviso discreto con su icono, para las notas al pie. */
@Composable
fun NotaAlPie(icono: ImageVector, texto: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(VerdePanelClaro.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        IconoRedondo(icono, tamano = 34, color = TextoTenue, fondo = Color.Transparent)
        Text(texto, color = TextoTenue, style = MaterialTheme.typography.bodySmall)
    }
}
