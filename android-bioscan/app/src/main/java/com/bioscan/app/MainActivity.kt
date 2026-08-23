package com.bioscan.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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
 * La app entra directa a la pantalla de trabajo.
 *
 * No hay pantalla de bienvenida: en XiloScan la de arranque acabo estorbando y se movio
 * a la ayuda. Aqui la explicacion vive en la propia pantalla principal, visible mientras
 * no haya ninguna consulta hecha, que es cuando de verdad hace falta.
 */
@Composable
private fun App() {
    PantallaPrincipal()
}
