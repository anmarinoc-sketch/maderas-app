package com.bioscan.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PantallaAjustes(vm: BioViewModel, onCerrar: () -> Unit) {
    // Las propiedades del ViewModel escriben en SharedPreferences pero no son estado
    // observable: sin esta copia local, mover el interruptor no redibujaria nada y
    // pareceria que la app ignora el gesto.
    var url by remember { mutableStateOf(vm.urlServidor) }
    var clave by remember { mutableStateOf(vm.claveApp) }
    var relato by remember { mutableStateOf(vm.pedirRelato) }

    val diagnostico by vm.diagnostico.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ajustes") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                actions = {
                    IconButton(onClick = {
                        vm.limpiarDiagnostico()
                        onCerrar()
                    }) {
                        Icon(Icons.Default.Close, contentDescription = "Cerrar")
                    }
                },
            )
        }
    ) { relleno ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(relleno)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                )
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Explicación redactada", fontWeight = FontWeight.Bold)
                            Text(
                                "Es lo único que consume cuota de IA. Apagándola, consultar " +
                                    "por nombre no gasta ninguna consulta y sigues viendo " +
                                    "veda, amenaza, endemismo y distribución.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Switch(
                            checked = relato,
                            onCheckedChange = {
                                relato = it
                                vm.pedirRelato = it
                            },
                        )
                    }
                }
            }

            Column {
                Text("Servidor", fontWeight = FontWeight.Bold)
                Text(
                    "El mismo backend que usa XiloScan.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            OutlinedTextField(
                value = url,
                onValueChange = {
                    url = it
                    vm.urlServidor = it
                },
                label = { Text("URL del servidor") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = clave,
                onValueChange = {
                    clave = it
                    vm.claveApp = it
                },
                label = { Text("Clave de la app (opcional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = vm::comprobarServidor,
                    modifier = Modifier.weight(1f),
                ) { Text("Comprobar") }

                OutlinedButton(
                    onClick = {
                        vm.urlServidor = ""
                        vm.claveApp = ""
                        url = vm.urlServidor
                        clave = vm.claveApp
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("Restaurar") }
            }

            diagnostico?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }

            Card {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("De dónde salen los datos", fontWeight = FontWeight.Bold)
                    Text(
                        "· Resolución 0126 de 2024 (MADS), que derogó la 1912 de 2017: " +
                            "categorías de amenaza de flora y fauna.\n" +
                            "· Catálogo de Plantas y Líquenes de Colombia: origen, " +
                            "endemismo, distribución y CITES.\n" +
                            "· Lista de plantas exóticas del Instituto Humboldt.\n" +
                            "· Vedas nacionales (recopilación del MADS) y Resolución 3183 " +
                            "de 2000 de Corantioquia.\n" +
                            "· Cornare: el Acuerdo 404 de 2020 está transcrito solo en parte.",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    Text(
                        "Esta app no sustituye la consulta a la autoridad ambiental.",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 10.dp),
                    )
                }
            }
        }
    }
}
