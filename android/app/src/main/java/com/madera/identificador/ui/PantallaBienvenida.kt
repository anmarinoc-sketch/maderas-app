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
import kotlinx.coroutines.delay

private val VerdeFondo = Color(0xFF1E2B1C)
private val Crema = Color(0xFFF0E6D2)
private val VerdeClaro = Color(0xFF8FBF6A)
private val TextoSuave = Color(0xFFC9C3B6)

/**
 * Pantalla de bienvenida. Se muestra al abrir y se va sola; el fondo coincide con
 * windowBackground para que no haya destello blanco al arrancar en frio.
 */
@Composable
fun PantallaBienvenida(onTerminar: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    val opacidad by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(durationMillis = 700),
        label = "aparicion",
    )

    LaunchedEffect(Unit) {
        visible = true
        delay(3600)
        onTerminar()
    }

    Surface(color = VerdeFondo, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .alpha(opacidad),
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
        }
    }
}

/**
 * Explicacion de como funciona y de hasta donde llega. Se muestra la primera vez y
 * queda accesible desde la ayuda del visor.
 *
 * Se dice el margen de error de forma honesta: en pruebas internas acierta la especie
 * en torno a la mitad de las veces con imagenes buenas, y esa cifra viene de una muestra
 * pequeña. Prometer mas seria enganar a alguien que decide compras con esto.
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
                detalle = "Pasa el bisturí o una navaja afilada por la punta de la pieza y " +
                    "mójala con un poco de agua. Así se ven los poritos y los anillos.",
            )
            Paso(
                numero = "2",
                titulo = "Toma la foto",
                detalle = "Acércate hasta que el corte llene el marco, con luz entrando de " +
                    "lado. La app te avisa si hay poca luz.",
            )
            Paso(
                numero = "3",
                titulo = "Lee el resultado",
                detalle = "Verás la especie más probable, la anatomía que el análisis dice " +
                    "haber visto, otras especies compatibles y qué le faltó a la foto.",
            )

            Spacer(Modifier.height(24.dp))

            Text(
                "Hasta dónde llega",
                color = VerdeClaro,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "XiloScan es una ayuda de campo, no un peritaje. En nuestras pruebas acierta " +
                    "la especie aproximadamente la mitad de las veces con fotos buenas, y esa " +
                    "cifra sale de una muestra pequeña: tómala como orden de magnitud.",
                color = TextoSuave,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "Por eso el resultado viene con un porcentaje de confianza. Cuando no llega al " +
                    "60 % aparece como «candidata sin confirmar»: ahí conviene mirar también " +
                    "las otras especies compatibles.",
                color = TextoSuave,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "Mirando solo una foto, muchas maderas no se pueden separar más allá del " +
                    "género. Confirmar una especie con seguridad exige microscopio y, en " +
                    "maderas protegidas, análisis de laboratorio.",
                color = TextoSuave,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "Conoce sobre todo las 34 maderas comerciales del Valle de Aburrá, según la " +
                    "guía de la Universidad Nacional sede Medellín. Fuera de esa lista, " +
                    "responde con conocimiento general y acierta menos.",
                color = TextoSuave,
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
                Text("Entendido, empezar", fontWeight = FontWeight.Bold)
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
