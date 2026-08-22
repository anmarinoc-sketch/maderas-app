# Gson instancia los modelos por reflexion: si R8 renombra sus campos, el JSON deja de mapear.
-keep class com.madera.identificador.data.** { *; }
-keepattributes Signature, *Annotation*, EnclosingMethod, InnerClasses

# Retrofit conserva los tipos genericos de los metodos suspend a traves de la firma.
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-dontwarn okio.**
