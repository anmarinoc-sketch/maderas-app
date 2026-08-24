package com.bioscan.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.bioscan.app.ui.PantallaBienvenida
import com.bioscan.app.ui.PantallaPrincipal
import com.bioscan.app.ui.theme.TemaBioScan

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TemaBioScan {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    App()
                }
            }
        }
    }
}

/**
 * Bienvenida y luego trabajo.
 *
 * La bienvenida espera al boton Comenzar, no se quita sola: quien abre la app con el
 * telefono en una mano y una rama en la otra no tiene tiempo de leer algo que se va solo.
 */
@Composable
private fun App() {
    var empezado by remember { mutableStateOf(false) }

    if (empezado) PantallaPrincipal() else PantallaBienvenida(onComenzar = { empezado = true })
}
