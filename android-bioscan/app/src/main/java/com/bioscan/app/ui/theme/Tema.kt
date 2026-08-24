package com.bioscan.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/*
 * Paleta de BioScan: bosque húmedo de noche.
 *
 * Es un tema OSCURO SIEMPRE, no uno que siga al sistema. Dos razones: la app se usa en
 * campo, donde el contraste alto con fondo oscuro se lee mejor a pleno sol y gasta menos
 * batería en pantallas OLED; y mantener dos paletas coherentes con los colores de
 * gravedad —rojo vedada, naranja amenazada, verde libre— duplicaba el trabajo sin que
 * nadie lo hubiera pedido.
 */

val VerdeFondo = Color(0xFF071A13)
val VerdePanel = Color(0xFF0E2A1F)
val VerdePanelClaro = Color(0xFF15382A)
val VerdeBorde = Color(0xFF1F4D39)

/** El verde vivo de la marca: acentos, iconos activos y el botón principal. */
val VerdeMarca = Color(0xFF4ADE80)
val VerdeSuave = Color(0xFF86EFAC)

val TextoClaro = Color(0xFFE8F5EE)
val TextoTenue = Color(0xFF9CBBA9)

private val Esquema = darkColorScheme(
    primary = VerdeMarca,
    onPrimary = Color(0xFF04120C),
    primaryContainer = VerdePanelClaro,
    onPrimaryContainer = TextoClaro,
    secondary = VerdeSuave,
    onSecondary = Color(0xFF04120C),
    secondaryContainer = VerdePanel,
    onSecondaryContainer = TextoClaro,
    background = VerdeFondo,
    onBackground = TextoClaro,
    surface = VerdePanel,
    onSurface = TextoClaro,
    surfaceVariant = VerdePanelClaro,
    onSurfaceVariant = TextoTenue,
    outline = VerdeBorde,
    outlineVariant = VerdeBorde,
    error = Color(0xFFE5766B),
    onError = Color(0xFF3A0906),
    errorContainer = Color(0xFF5C1A14),
    onErrorContainer = Color(0xFFFFDAD4),
)

@Composable
fun TemaBioScan(content: @Composable () -> Unit) {
    val vista = LocalView.current

    if (!vista.isInEditMode) {
        SideEffect {
            val ventana = (vista.context as Activity).window
            // La barra de estado se funde con el fondo: la cabecera ya lleva su propio
            // color y una franja distinta encima la partiría en dos.
            ventana.statusBarColor = VerdeFondo.toArgb()
            ventana.navigationBarColor = VerdeFondo.toArgb()
            WindowCompat.getInsetsController(ventana, vista).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(colorScheme = Esquema, content = content)
}
