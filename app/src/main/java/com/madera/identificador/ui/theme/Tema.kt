package com.madera.identificador.ui.theme

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

// Paleta tomada de la madera: nogal, roble claro y savia.
private val Nogal = Color(0xFF6B4423)
private val NogalClaro = Color(0xFF8D6240)
private val RobleClaro = Color(0xFFE8D6B8)
private val Savia = Color(0xFF4F6F52)
private val Corteza = Color(0xFF3E2A1B)
private val Papel = Color(0xFFFDFAF5)

private val EsquemaClaro = lightColorScheme(
    primary = Nogal,
    onPrimary = Color.White,
    primaryContainer = RobleClaro,
    onPrimaryContainer = Corteza,
    secondary = Savia,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD6E4D7),
    onSecondaryContainer = Color(0xFF1F2E20),
    background = Papel,
    onBackground = Corteza,
    surface = Color.White,
    onSurface = Corteza,
    surfaceVariant = Color(0xFFF2EAdd),
    onSurfaceVariant = Color(0xFF5A4636),
    error = Color(0xFFA33A2B),
)

private val EsquemaOscuro = darkColorScheme(
    primary = RobleClaro,
    onPrimary = Corteza,
    primaryContainer = NogalClaro,
    onPrimaryContainer = Color(0xFFFFF3E4),
    secondary = Color(0xFF9FC0A2),
    onSecondary = Color(0xFF1F2E20),
    secondaryContainer = Color(0xFF354A37),
    onSecondaryContainer = Color(0xFFD6E4D7),
    background = Color(0xFF1A140F),
    onBackground = Color(0xFFF0E6DA),
    surface = Color(0xFF241C15),
    onSurface = Color(0xFFF0E6DA),
    surfaceVariant = Color(0xFF3A2E24),
    onSurfaceVariant = Color(0xFFD8C7B4),
    error = Color(0xFFE59084),
)

@Composable
fun TemaIdentificaMadera(
    oscuro: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val esquema = if (oscuro) EsquemaOscuro else EsquemaClaro
    val vista = LocalView.current

    if (!vista.isInEditMode) {
        SideEffect {
            val ventana = (vista.context as Activity).window
            ventana.statusBarColor = esquema.primary.toArgb()
            WindowCompat.getInsetsController(ventana, vista).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = esquema,
        content = content,
    )
}
