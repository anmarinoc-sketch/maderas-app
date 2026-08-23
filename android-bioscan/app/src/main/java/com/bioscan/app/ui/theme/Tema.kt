package com.bioscan.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Paleta de bosque humedo: verde profundo, hoja nueva y tierra. Deliberadamente
// distinta de la de XiloScan (maderas y ocres) para no confundir las dos apps.
private val Selva = Color(0xFF0F3D2E)
private val SelvaClara = Color(0xFF2E6B52)
private val HojaNueva = Color(0xFFB7E4C7)
private val Musgo = Color(0xFF52796F)
private val Humus = Color(0xFF1B2B24)
private val Niebla = Color(0xFFF6FAF7)

private val EsquemaClaro = lightColorScheme(
    primary = Selva,
    onPrimary = Color.White,
    primaryContainer = HojaNueva,
    onPrimaryContainer = Humus,
    secondary = Musgo,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD5E8DE),
    onSecondaryContainer = Color(0xFF16302A),
    background = Niebla,
    onBackground = Humus,
    surface = Color.White,
    onSurface = Humus,
    surfaceVariant = Color(0xFFE7F0EA),
    onSurfaceVariant = Color(0xFF41564C),
    error = Color(0xFFA33A2B),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD4),
    onErrorContainer = Color(0xFF410100),
)

private val EsquemaOscuro = darkColorScheme(
    primary = HojaNueva,
    onPrimary = Humus,
    primaryContainer = SelvaClara,
    onPrimaryContainer = Color(0xFFE8F5EC),
    secondary = Color(0xFF9CC5B6),
    onSecondary = Color(0xFF16302A),
    secondaryContainer = Color(0xFF2F4A41),
    onSecondaryContainer = Color(0xFFD5E8DE),
    background = Color(0xFF101815),
    onBackground = Color(0xFFE3EDE7),
    surface = Color(0xFF18231E),
    onSurface = Color(0xFFE3EDE7),
    surfaceVariant = Color(0xFF2A3831),
    onSurfaceVariant = Color(0xFFC3D3CA),
    error = Color(0xFFE59084),
    onError = Color(0xFF410100),
    errorContainer = Color(0xFF6B2B22),
    onErrorContainer = Color(0xFFFFDAD4),
)

@Composable
fun TemaBioScan(
    oscuro: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val esquema = if (oscuro) EsquemaOscuro else EsquemaClaro
    val vista = LocalView.current

    if (!vista.isInEditMode) {
        SideEffect {
            val ventana = (vista.context as Activity).window
            ventana.statusBarColor = Selva.toArgb()
            WindowCompat.getInsetsController(ventana, vista).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(colorScheme = esquema, content = content)
}
