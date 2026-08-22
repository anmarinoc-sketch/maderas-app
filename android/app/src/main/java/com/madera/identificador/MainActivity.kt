package com.madera.identificador

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
import com.madera.identificador.ui.PantallaBienvenida
import com.madera.identificador.ui.PantallaExplicacion
import com.madera.identificador.ui.PantallaIdentificar
import com.madera.identificador.ui.theme.TemaIdentificaMadera

/** Etapas por las que pasa la app al abrirse. */
private enum class Fase { BIENVENIDA, EXPLICACION, TRABAJO }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TemaIdentificaMadera {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    Arranque()
                }
            }
        }
    }
}

@Composable
private fun Arranque() {
    var fase by remember { mutableStateOf(Fase.BIENVENIDA) }

    when (fase) {
        // La bienvenida espera a que se pulse Empezar. La explicacion ya no interrumpe
        // el arranque: se consulta desde la ayuda del visor cuando hace falta.
        Fase.BIENVENIDA -> PantallaBienvenida(onEmpezar = { fase = Fase.TRABAJO })

        Fase.EXPLICACION -> PantallaExplicacion(onEmpezar = { fase = Fase.TRABAJO })

        Fase.TRABAJO -> PantallaIdentificar(
            onVerExplicacion = { fase = Fase.EXPLICACION }
        )
    }
}
