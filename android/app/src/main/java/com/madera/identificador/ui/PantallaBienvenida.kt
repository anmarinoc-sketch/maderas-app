package com.madera.identificador.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.madera.identificador.R

private val VerdeFondo = Color(0xFF1E2B1C)
private val Crema = Color(0xFFF0E6D2)
private val VerdeClaro = Color(0xFF8FBF6A)
private val TextoSuave = Color(0xFFC9C3B6)

/**
 * Pantalla de bienvenida. Espera a que se pulse Empezar en vez de irse sola: una
 * pantalla que desaparece a destiempo obliga a reabrir la app para volver a leerla.
 * El fondo coincide con windowBackground para que no haya destello al arrancar en frio.
 */
@Composable
fun PantallaBienvenida(onEmpezar: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    val opacidad by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(durationMillis = 700),
        label = "aparicion",
    )

    LaunchedEffect(Unit) { visible = true }

    Surface(color = VerdeFondo, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .alpha(opacidad)
                .padding(32.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.logo_xiloscan),
                contentDescription = "XiloScan",
                modifier = Modifier.size(180.dp),
            )
            Spacer(Modifier.height(24.dp))
            Row {
                Text("Xilo", color = Crema, fontSize = 40.sp, fontWeight = FontWeight.Bold)
                Text("Scan", color = VerdeClaro, fontSize = 40.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(10.dp))
            Text(
                "Identifica la madera, conoce su origen.",
                color = TextoSuave,
                fontStyle = FontStyle.Italic,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(48.dp))

            Button(
                onClick = onEmpezar,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = VerdeClaro,
                    contentColor = Color(0xFF14210F),
                ),
            ) {
                Text("Empezar", fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(14.dp))
            Text(
                "Versión ${com.madera.identificador.BuildConfig.VERSION_NAME}",
                color = TextoSuave,
                style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            )
        }
    }
}

/**
 * Metodo de trabajo en tres pasos. Se abre desde la ayuda del visor; ya no interrumpe
 * el arranque, donde solo estorbaba a quien ya lo conoce.
 *
 * El apartado sobre el margen de error se retiro de aqui a peticion del usuario. La
 * advertencia sigue donde mas pesa: junto a cada resultado, que por debajo del 60 % de
 * confianza se presenta como "candidata sin confirmar" y lleva la nota de que esto es
 * una ayuda y no un peritaje.
 */
@Composable
fun PantallaExplicacion(onEmpezar: () -> Unit) {
    Surface(color = VerdeFondo, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(28.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(R.drawable.logo_xiloscan),
                    contentDescription = null,
                    modifier = Modifier.size(56.dp),
                )
                Spacer(Modifier.width(12.dp))
                Row {
                    Text("Xilo", color = Crema, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                    Text("Scan", color = VerdeClaro, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(28.dp))

            Paso(
                numero = "1",
                titulo = "Prepara la cara del corte",
                detalle = "Trabaja sobre la punta de la pieza, la cara que atraviesa la veta. " +
                    "Pasa el bisturí o una navaja bien afilada: corta, no raspes, porque el " +
                    "aserrín tapa el tejido. Humedece con una gota de agua para levantar el " +
                    "contraste y ver mejor las características microscópicas.",
            )
            Paso(
                numero = "2",
                titulo = "Toma la foto",
                detalle = "Acércate hasta que el corte llene el encuadre, unos 3 a 5 cm de " +
                    "madera, ayudándote del zoom del visor. La luz debe entrar de lado y baja: " +
                    "así los poros y el parénquima proyectan sombra y se distinguen. Nunca de " +
                    "frente, que aplana el relieve. Después recorta para dejar solo madera.",
            )
            Paso(
                numero = "3",
                titulo = "Contrasta el resultado",
                detalle = "El análisis describe primero lo que observa —porosidad, tamaño y " +
                    "agrupación de los poros, tipo de parénquima axial y finura de los radios— " +
                    "y solo después propone la especie, con su confianza y otras compatibles. " +
                    "Compara esa descripción con tu pieza: si la anatomía no cuadra, el nombre " +
                    "no vale, por convincente que suene. Confirma o corrige el resultado y esa " +
                    "corrección se tendrá en cuenta en los análisis siguientes.",
            )

            Spacer(Modifier.height(32.dp))

            Button(
                onClick = onEmpezar,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = VerdeClaro,
                    contentColor = Color(0xFF14210F),
                ),
            ) {
                Text("Entendido", fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun Paso(numero: String, titulo: String, detalle: String) {
    Row(modifier = Modifier.padding(bottom = 18.dp)) {
        Text(
            numero,
            color = VerdeClaro,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(32.dp),
        )
        Column {
            Text(titulo, color = Crema, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(2.dp))
            Text(detalle, color = TextoSuave)
        }
    }
}
