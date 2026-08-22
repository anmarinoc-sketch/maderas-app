package com.madera.identificador.util

import android.content.Context
import com.madera.identificador.BuildConfig

/**
 * Ajustes locales de la app.
 *
 * La URL del backend se fija al compilar (BuildConfig.BASE_URL) pero se puede cambiar
 * desde la app: asi el mismo APK sirve para el emulador, para un tunel de pruebas y para
 * el servidor definitivo, sin recompilar.
 */
class Ajustes(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("ajustes_madera", Context.MODE_PRIVATE)

    var urlServidor: String
        get() = prefs.getString(CLAVE_URL, null)?.takeIf { it.isNotBlank() } ?: BuildConfig.BASE_URL
        set(valor) = prefs.edit().putString(CLAVE_URL, valor.trim()).apply()

    /** Secreto compartido opcional (cabecera X-App-Key). Vacio = el backend no lo exige. */
    var claveApp: String
        get() = prefs.getString(CLAVE_APP_KEY, null) ?: BuildConfig.APP_API_KEY
        set(valor) = prefs.edit().putString(CLAVE_APP_KEY, valor.trim()).apply()

    fun restaurarValoresDeCompilacion() {
        prefs.edit().remove(CLAVE_URL).remove(CLAVE_APP_KEY).apply()
    }

    private companion object {
        const val CLAVE_URL = "url_servidor"
        const val CLAVE_APP_KEY = "clave_app"
    }
}
