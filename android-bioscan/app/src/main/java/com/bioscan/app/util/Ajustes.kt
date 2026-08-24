package com.bioscan.app.util

import android.content.Context
import com.bioscan.app.BuildConfig

/**
 * Ajustes locales de la app.
 *
 * La URL del backend se fija al compilar (BuildConfig.BASE_URL) pero se puede cambiar
 * desde la app: asi el mismo APK sirve para el emulador, para un tunel de pruebas y para
 * el servidor definitivo, sin recompilar.
 */
class Ajustes(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("ajustes_bioscan", Context.MODE_PRIVATE)

    var urlServidor: String
        get() = prefs.getString(CLAVE_URL, null)?.takeIf { it.isNotBlank() } ?: BuildConfig.BASE_URL
        set(valor) = prefs.edit().putString(CLAVE_URL, valor.trim()).apply()

    /** Secreto compartido opcional (cabecera X-App-Key). Vacio = el backend no lo exige. */
    var claveApp: String
        get() = prefs.getString(CLAVE_APP_KEY, null) ?: BuildConfig.APP_API_KEY
        set(valor) = prefs.edit().putString(CLAVE_APP_KEY, valor.trim()).apply()

    /**
     * Si se pide la explicacion redactada, que es lo unico que gasta cuota de Gemini.
     *
     * Se puede apagar: con esto en falso, consultar por nombre una especie que este en
     * las listas no consume ni una peticion, y la app sigue dando veda, amenaza,
     * endemismo y distribucion. Util el dia que se agote la cuota.
     */
    var pedirRelato: Boolean
        get() = prefs.getBoolean(CLAVE_RELATO, true)
        set(valor) = prefs.edit().putBoolean(CLAVE_RELATO, valor).apply()

    fun restaurarValoresDeCompilacion() {
        prefs.edit().remove(CLAVE_URL).remove(CLAVE_APP_KEY).apply()
    }

    private companion object {
        const val CLAVE_URL = "url_servidor"
        const val CLAVE_APP_KEY = "clave_app"
        const val CLAVE_RELATO = "pedir_relato"
    }
}
