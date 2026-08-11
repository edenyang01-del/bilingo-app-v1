import { AndroidFile } from '../types';

export const androidProjectFiles: AndroidFile[] = [
  {
    path: 'android/app/build.gradle.kts',
    name: 'build.gradle.kts',
    category: 'gradle',
    language: 'kotlin',
    content: `plugins {
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
        versionCode = 1
        versionName = "1.0"
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
    // AndroidX & Jetpack Compose Material 3
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")

    // AndroidX Media3 (ExoPlayer for Live Bilingo Radio)
    implementation("androidx.media3:media3-exoplayer:1.3.1")

    // OkHttp WebSocket (Deepgram Speech-to-Text)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Google Mobile Ads (AdMob Non-Intrusive Banner Ads)
    implementation("com.google.android.gms:play-services-ads:23.1.0")
}`
  },
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    category: 'manifest',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Live Bilingo 雙語電台"
        android:theme="@style/Theme.BilingoRadio">

        <!-- Google AdMob Application ID -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-7732369001198376~9508349578"/>
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="Live Bilingo 雙語電台">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/MainActivity.kt',
    name: 'MainActivity.kt',
    category: 'ui',
    language: 'kotlin',
    content: `package com.bilingo.radio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.bilingo.radio.ui.screens.MainScreen
import com.bilingo.radio.ui.theme.BilingoRadioTheme
import com.bilingo.radio.viewmodel.RadioSubtitleViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: RadioSubtitleViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BilingoRadioTheme {
                MainScreen(viewModel = viewModel)
            }
        }
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/player/RadioPlayerManager.kt',
    name: 'RadioPlayerManager.kt',
    category: 'player',
    language: 'kotlin',
    content: `package com.bilingo.radio.player

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class PlaybackState { IDLE, BUFFERING, PLAYING, PAUSED, ERROR }

class RadioPlayerManager(private val context: Context) {
    private var exoPlayer: ExoPlayer? = null
    val defaultStreamUrl = "https://npr-ice.streamguys1.com/live.mp3"
    private val _playbackState = MutableStateFlow(PlaybackState.IDLE)
    val playbackState: StateFlow<PlaybackState> = _playbackState

    fun initializePlayer() {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build().apply {
                val mediaItem = MediaItem.fromUri(Uri.parse(defaultStreamUrl))
                setMediaItem(mediaItem)
                prepare()
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        _playbackState.value = if (isPlaying) PlaybackState.PLAYING else PlaybackState.PAUSED
                    }
                })
            }
        }
    }

    fun play() {
        initializePlayer()
        exoPlayer?.playWhenReady = true
        exoPlayer?.play()
    }

    fun pause() {
        exoPlayer?.pause()
    }

    fun release() {
        exoPlayer?.release()
        exoPlayer = null
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/stt/DeepgramWebSocketClient.kt',
    name: 'DeepgramWebSocketClient.kt',
    category: 'stt',
    language: 'kotlin',
    content: `package com.bilingo.radio.stt

import okhttp3.*
import org.json.JSONObject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

class DeepgramWebSocketClient(
    private val apiKey: String = "26c44e288a84756af4f80d41436af0bf7cc10715"
) {
    private val client = OkHttpClient()
    private var webSocket: WebSocket? = null
    private val _transcriptFlow = MutableSharedFlow<String>(extraBufferCapacity = 64)
    val transcriptFlow: SharedFlow<String> = _transcriptFlow

    fun connect() {
        val url = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Token $apiKey")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    if (json.optBoolean("is_final")) {
                        val transcript = json.optJSONObject("channel")
                            ?.optJSONArray("alternatives")
                            ?.optJSONObject(0)
                            ?.optString("transcript", "")
                        if (!transcript.isNullOrBlank()) {
                            _transcriptFlow.tryEmit(transcript)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "Disconnected")
        webSocket = null
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/translation/GeminiTranslationRepository.kt',
    name: 'GeminiTranslationRepository.kt',
    category: 'stt',
    language: 'kotlin',
    content: `package com.bilingo.radio.translation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class GeminiTranslationRepository(
    private val apiKey: String = "YOUR_GEMINI_API_KEY"
) {
    private val client = OkHttpClient()

    suspend fun translateToTraditionalChinese(englishText: String): String = withContext(Dispatchers.IO) {
        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"
        val prompt = "Translate this public radio transcript to Traditional Chinese (繁體中文). Return ONLY translated text: $englishText"
        
        val json = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                    })
                })
            })
        }

        val request = Request.Builder()
            .url(url)
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: ""
        
        return@withContext parseGeminiResponse(body)
    }

    private fun parseGeminiResponse(body: String): String {
        return try {
            JSONObject(body)
            .getJSONArray("candidates")
            .getJSONObject(0)
            .getJSONObject("content")
            .getJSONArray("parts")
            .getJSONObject(0)
            .getString("text").trim()
        } catch (e: Exception) {
            "（翻譯中...）"
        }
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/ui/screens/MainScreen.kt',
    name: 'MainScreen.kt',
    category: 'ui',
    language: 'kotlin',
    content: `package com.bilingo.radio.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.bilingo.radio.ui.components.BilingualCard
import com.bilingo.radio.viewmodel.RadioSubtitleViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: RadioSubtitleViewModel) {
    val playbackState by viewModel.playbackState.collectAsState()
    val subtitleList by viewModel.subtitleList.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Live Bilingo 雙語電台") }
            )
        },
        bottomBar = {
            // Google AdMob Banner Ad (Non-intrusive bottom banner)
            AndroidView(
                modifier = Modifier.fillMaxWidth(),
                factory = { context ->
                    AdView(context).apply {
                        setAdSize(AdSize.BANNER)
                        // Ad Unit ID generated from AdMob Console
                        adUnitId = "ca-app-pub-7732369001198376/8530309826"
                        loadAd(AdRequest.Builder().build())
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.togglePlayPause() }
            ) {
                Icon(
                    imageVector = if (playbackState == PlaybackState.PLAYING) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = "Play/Pause"
                )
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            items(subtitleList, key = { it.id }) { item ->
                BilingualCard(subtitle = item)
            }
        }
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/ui/components/BilingualCard.kt',
    name: 'BilingualCard.kt',
    category: 'ui',
    language: 'kotlin',
    content: `package com.bilingo.radio.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bilingo.radio.model.SubtitleItem

@Composable
fun BilingualCard(subtitle: SubtitleItem) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = subtitle.timestamp,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle.englishText,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = subtitle.chineseText,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}`
  }
];
