package com.bioscan.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bioscan.app.R

private val FondoBosque = Color(0xFF0C2E24)
private val VerdeBoton = Color(0xFF6FBF73)
private val VerdeClaro = Color(0xFF8FD79A)

/**
 * Pantalla de arranque.
 *
 * Espera a que se pulse Comenzar, igual que XiloScan: en aquella app la bienvenida que se
 * quitaba sola resultaba molesta, porque quien abre la app con el telefono en una mano y
 * una rama en la otra no tiene tiempo de leer nada que se vaya solo.
 */
@Composable
fun PantallaBienvenida(onComenzar: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(FondoBosque)
            .padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.logo_bioscan),
            contentDescription = "BioScan",
            modifier = Modifier.size(150.dp),
        )

        Spacer(Modifier.height(20.dp))

        // "Bio" claro y "Scan" verde, como en el logo.
        Text(
            nombreDeLaApp(),
            fontSize = 44.sp,
            fontWeight = FontWeight.Bold,
        )

        Spacer(Modifier.height(14.dp))

        Text(
            "Explora y protege\nla biodiversidad que te rodea.",
            color = VerdeClaro,
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.titleMedium,
        )

        Spacer(Modifier.height(40.dp))

        Button(
            onClick = onComenzar,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = VerdeBoton,
                contentColor = Color(0xFF0C2E24),
            ),
        ) {
            Text("Comenzar", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(24.dp))

        Text(
            "Conoce · Protege · Conserva",
            color = VerdeClaro.copy(alpha = 0.7f),
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/**
 * "BioScan" con las dos mitades en colores distintos.
 *
 * Se arma con AnnotatedString y no con dos Text seguidos porque en una Row se separarian
 * al ajustar el interletraje y quedaria "Bio Scan".
 */
private fun nombreDeLaApp() = buildAnnotatedString {
    withStyle(SpanStyle(color = Color.White)) { append("Bio") }
    withStyle(SpanStyle(color = VerdeBoton)) { append("Scan") }
}
