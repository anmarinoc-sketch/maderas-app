package com.bioscan.app.util

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/** Una especie consultada, con lo justo para pintar una fila y volver a abrirla. */
data class Guardada(
    val nombreCientifico: String,
    val nombreComun: String? = null,
    val familia: String? = null,
    val fotoUrl: String? = null,
    val amenaza: String? = null,
    val vedada: Boolean = false,
    val endemica: Boolean = false,
    val cuando: Long = System.currentTimeMillis(),
)

/**
 * Historial y favoritos, en el propio telefono.
 *
 * Nada de esto va al servidor, y es a proposito: el disco de Render es efimero y se borra
 * en cada despliegue, asi que guardar alli lo que el usuario acumula seria prometer algo
 * que no se puede cumplir. Ademas no hay cuentas de usuario, y montarlas por guardar una
 * lista de plantas seria desproporcionado.
 *
 * Se guarda como JSON en SharedPreferences. Son unas decenas de fichas: no compensa una
 * base de datos.
 */
class Guardados(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("guardados_bioscan", Context.MODE_PRIVATE)

    private val gson = Gson()
    private val tipo = object : TypeToken<List<Guardada>>() {}.type

    private fun leer(clave: String): List<Guardada> =
        runCatching { gson.fromJson<List<Guardada>>(prefs.getString(clave, null), tipo) }
            .getOrNull() ?: emptyList()

    private fun escribir(clave: String, lista: List<Guardada>) {
        prefs.edit().putString(clave, gson.toJson(lista)).apply()
    }

    /* ------------------------------------------------------------------ historial */

    fun historial(): List<Guardada> = leer(HISTORIAL)

    /**
     * Anota una consulta. La misma especie no se repite: sube al principio con la fecha
     * nueva, que es lo que uno espera de un historial.
     */
    fun anotar(entrada: Guardada) {
        val sinRepetir = historial().filterNot { esLaMisma(it, entrada) }
        escribir(HISTORIAL, (listOf(entrada) + sinRepetir).take(MAXIMO))
    }

    fun borrarHistorial() = escribir(HISTORIAL, emptyList())

    /* ------------------------------------------------------------------ favoritos */

    fun favoritos(): List<Guardada> = leer(FAVORITOS)

    fun esFavorita(nombreCientifico: String): Boolean =
        favoritos().any { it.nombreCientifico.equals(nombreCientifico, ignoreCase = true) }

    /** Devuelve el estado nuevo, para que la pantalla no tenga que volver a preguntarlo. */
    fun alternarFavorita(entrada: Guardada): Boolean {
        val actuales = favoritos()
        val yaEsta = actuales.any { esLaMisma(it, entrada) }

        escribir(
            FAVORITOS,
            if (yaEsta) actuales.filterNot { esLaMisma(it, entrada) }
            else listOf(entrada) + actuales,
        )
        return !yaEsta
    }

    fun quitarFavorita(nombreCientifico: String) {
        escribir(FAVORITOS, favoritos().filterNot {
            it.nombreCientifico.equals(nombreCientifico, ignoreCase = true)
        })
    }

    private fun esLaMisma(a: Guardada, b: Guardada) =
        a.nombreCientifico.equals(b.nombreCientifico, ignoreCase = true)

    private companion object {
        const val HISTORIAL = "historial"
        const val FAVORITOS = "favoritos"

        /** Suficiente para semanas de uso, y no tanto como para engordar las preferencias. */
        const val MAXIMO = 60
    }
}
