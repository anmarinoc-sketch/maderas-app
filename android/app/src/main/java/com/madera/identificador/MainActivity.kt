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
import androidx.compose.ui.platform.LocalContext
import com.madera.identificador.ui.PantallaBienvenida
import com.madera.identificador.ui.PantallaExplicacion
import com.madera.identificador.ui.PantallaIdentificar
import com.madera.identificador.ui.theme.TemaIdentificaMadera
import com.madera.identificador.util.Ajustes

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
    val context = LocalContext.current
    val ajustes = remember { Ajustes(context) }
    var fase by remember { mutableStateOf(Fase.BIENVENIDA) }

    when (fase) {
        Fase.BIENVENIDA -> PantallaBienvenida(
            onTerminar = {
                // La explicacion solo interrumpe la primera vez; despues se va directo
                // al visor, que es donde se trabaja.
                fase = if (ajustes.explicacionVista) Fase.TRABAJO else Fase.EXPLICACION
            }
        )

        Fase.EXPLICACION -> PantallaExplicacion(
            onEmpezar = {
                ajustes.explicacionVista = true
                fase = Fase.TRABAJO
            }
        )

        Fase.TRABAJO -> PantallaIdentificar()
    }
}
