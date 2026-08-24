plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

/**
 * URL del backend. Orden de precedencia:
 *   1. Variable de entorno BASE_URL     (override puntual desde GitHub Actions)
 *   2. baseUrl en gradle.properties     (el valor habitual, versionado en el repo)
 *   3. 10.0.2.2:3000                    (localhost visto desde el emulador)
 * Ademas el usuario puede cambiarla en caliente desde los ajustes de la app.
 */
val baseUrlPorDefecto: String =
    System.getenv("BASE_URL")?.takeIf { it.isNotBlank() }
        ?: (project.findProperty("baseUrl") as String?)?.takeIf { it.isNotBlank() }
        ?: "http://10.0.2.2:3000/"

/** Secreto compartido opcional (X-App-Key). Nunca se escribe en el repositorio. */
val appKeyPorDefecto: String =
    (project.findProperty("appKey") as String?)
        ?: System.getenv("APP_API_KEY")
        ?: ""

/**
 * Clave de firma: la MISMA que XiloScan, a proposito.
 *
 * Sin una clave estable, cada compilacion en CI genera la suya y Android rechaza
 * instalar la version nueva encima de la anterior. Compartirla no da ningun problema
 * porque el applicationId es distinto: para Android son dos apps sin relacion, solo
 * firmadas por el mismo autor.
 */
val claveFirma = file("../../android/keystore/xiloscan.p12")

android {
    namespace = "com.bioscan.app"
    compileSdk = 35

    signingConfigs {
        if (claveFirma.exists()) {
            getByName("debug") {
                storeFile = claveFirma
                storeType = "PKCS12"
                storePassword = "xiloscan"
                keyAlias = "xiloscan"
                keyPassword = "xiloscan"
            }
        }
    }

    defaultConfig {
        applicationId = "com.bioscan.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "6"

        buildConfigField("String", "BASE_URL", "\"$baseUrlPorDefecto\"")
        buildConfigField("String", "APP_API_KEY", "\"$appKeyPorDefecto\"")
    }

    buildTypes {
        debug {
            // Sufijo para poder tener debug y release instaladas a la vez.
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.exifinterface:exifinterface:1.3.7")

    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Carga la fotografia de la especie desde Wikipedia. Coil 2 va sobre OkHttp, que ya
    // esta, y trae cache en disco: la segunda consulta a la misma especie no descarga.
    implementation("io.coil-kt:coil-compose:2.7.0")

    debugImplementation(composeBom)
    debugImplementation("androidx.compose.ui:ui-tooling")
}
