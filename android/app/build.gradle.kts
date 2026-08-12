plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.bilingo.radio"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bilingo.radio"
        minSdk = 24
        targetSdk = 35
        versionCode = 201
        versionName = "2.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val ksFile = file("release.keystore")
            var storePass = System.getenv("RELEASE_STORE_PASSWORD")?.ifEmpty { null }
                ?: System.getenv("KEYSTORE_PASSWORD")?.ifEmpty { null }
                ?: "bilingo123456"
            var keyPass = System.getenv("RELEASE_KEY_PASSWORD")?.ifEmpty { null }
                ?: System.getenv("KEY_PASSWORD")?.ifEmpty { null }
                ?: storePass
            var alias = System.getenv("RELEASE_KEY_ALIAS")?.ifEmpty { null }
                ?: System.getenv("KEY_ALIAS")?.ifEmpty { null }
                ?: "bilingokey"

            var validReleaseKey = false
            var resolvedAlias = alias

            if (ksFile.exists() && ksFile.length() > 100) {
                try {
                    val ks = java.security.KeyStore.getInstance(java.security.KeyStore.getDefaultType())
                    ksFile.inputStream().use { inputStream ->
                        ks.load(inputStream, storePass.toCharArray())
                    }
                    if (ks.containsAlias(alias)) {
                        val key = try { ks.getKey(alias, keyPass.toCharArray()) } catch(e: Exception) { null }
                            ?: try { ks.getKey(alias, storePass.toCharArray()) } catch(e: Exception) { null }
                        if (key != null) {
                            validReleaseKey = true
                            resolvedAlias = alias
                        }
                    }
                    if (!validReleaseKey) {
                        val aliases = ks.aliases()
                        while (aliases.hasMoreElements()) {
                            val candidate = aliases.nextElement()
                            if (ks.isKeyEntry(candidate)) {
                                val key = try { ks.getKey(candidate, keyPass.toCharArray()) } catch(e: Exception) { null }
                                    ?: try { ks.getKey(candidate, storePass.toCharArray()) } catch(e: Exception) { null }
                                if (key != null) {
                                    validReleaseKey = true
                                    resolvedAlias = candidate
                                    keyPass = storePass
                                    break
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    println("Note: Release keystore validation error (${e.message}). Will generate fresh keystore.")
                }
            }

            if (!validReleaseKey) {
                println("Generating self-signed release keystore for build...")
                try {
                    if (ksFile.exists()) { ksFile.delete() }
                    storePass = "bilingo123456"
                    keyPass = "bilingo123456"
                    resolvedAlias = "bilingokey"
                    val pb = ProcessBuilder(
                        "keytool", "-genkeypair", "-v",
                        "-keystore", ksFile.absolutePath,
                        "-alias", resolvedAlias,
                        "-keyalg", "RSA",
                        "-keysize", "2048",
                        "-validity", "10000",
                        "-storepass", storePass,
                        "-keypass", keyPass,
                        "-dname", "CN=Bilingo, OU=Radio, O=Bilingo, L=Taipei, ST=Taiwan, C=TW"
                    )
                    val proc = pb.start()
                    proc.waitFor()
                    validReleaseKey = ksFile.exists() && ksFile.length() > 100
                } catch (e: Exception) {
                    println("Error generating fallback keystore: ${e.message}")
                }
            }

            if (validReleaseKey) {
                storeFile = ksFile
                storePassword = storePass
                keyAlias = resolvedAlias
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            signingConfig = signingConfigs.getByName("debug")
            isMinifyEnabled = false
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
        buildConfig = false
        resValues = false
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/DEPENDENCIES"
        }
    }
}

dependencies {
    // AndroidX & Lifecycle
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.2")
    implementation("androidx.activity:activity-compose:1.9.0")

    // Jetpack Compose & Material 3
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    debugImplementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")

    // AndroidX Media3 (ExoPlayer)
    implementation("androidx.media3:media3-exoplayer:1.3.1")

    // Networking (OkHttp for WebSockets & Gemini REST API)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coroutines & JSON Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
}
