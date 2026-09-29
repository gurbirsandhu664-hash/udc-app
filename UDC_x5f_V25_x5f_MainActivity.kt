package com.udc.app.v25

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// VERSION 25 - BILKUL NAVA - VERSION 24 NAL KOI LINK NAHI
// Eh Jetpack Compose te Chat Style ch hai - purane XML wala system khatam

class MainActivity_V25 : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                UDC_V25_App()
            }
        }
    }
}

@Composable
fun UDC_V25_App() {
    var question by remember { mutableStateOf("") }
    var messages by remember { mutableStateOf(listOf<ChatMsg>()) }
    var isLoading by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("UDC AI v25 - Nava Chat System", style = MaterialTheme.typography.headlineSmall)

        LazyColumn(modifier = Modifier.weight(1f).padding(top = 16.dp)) {
            items(messages) { msg ->
                Card(modifier = Modifier.fillMaxWidth().padding(4.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (msg.isUser) MaterialTheme.colorScheme.primaryContainer 
                        else MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Text(msg.text, modifier = Modifier.padding(12.dp))
                }
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = question,
                onValueChange = { question = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("UDC da sawal pucho...") }
            )
            Button(
                onClick = {
                    if (question.isNotBlank() && !isLoading) {
                        val q = question
                        messages = messages + ChatMsg(q, true)
                        question = ""
                        isLoading = true
                        // V25 NAVA AI LOGIC
                        CoroutineScope(Dispatchers.IO).launch {
                            val ans = getV25Answer(q)
                            withContext(Dispatchers.Main) {
                                messages = messages + ChatMsg(ans, false)
                                isLoading = false
                            }
                        }
                    }
                }
            ) {
                Text(if (isLoading) "..." else "Send")
            }
        }
    }
}

data class ChatMsg(val text: String, val isUser: Boolean)

// V25 - BILKUL NAVA AI ENGINE - V24 WALA CODE HATA DITTA
suspend fun getV25Answer(q: String): String {
    return try {
        val API_KEY = "APNI_GEMINI_API_KEY_ETHE_PAO"
        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$API_KEY")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true

        // V25 DA NAVA PROMPT - CHAT STYLE + UDC EXPERT
        val prompt = """
            Tu UDC v25 AI hai. Tu ek smart chat assistant hai.
            Rule: Lamba MCQ nahi, seedha chat wangu answer de. Dost wangu samjha.
            Style: Short, clear, exam-oriented.
            Question: $q
        """.trimIndent()

        val body = JSONObject().apply {
            put("contents", arrayOf(JSONObject().apply {
                put("parts", arrayOf(JSONObject().apply { put("text", prompt) }))
            }))
        }
        conn.outputStream.write(body.toString().toByteArray())
        val res = conn.inputStream.bufferedReader().readText()
        JSONObject(res).getJSONArray("candidates").getJSONObject(0)
            .getJSONObject("content").getJSONArray("parts").getJSONObject(0).getString("text")
    } catch (e: Exception) {
        "Error v25: ${e.message}"
    }
}
