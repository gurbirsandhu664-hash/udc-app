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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// VERSION 25 - SHOW HON WALA FINAL FIX
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                UDC_V25_App_Fixed()
            }
        }
    }
}

@Composable
fun UDC_V25_App_Fixed() {
    var question by remember { mutableStateOf("") }
    var messages by remember { mutableStateOf(listOf<ChatMsg>()) }
    var isLoading by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // VERSION 25 BADGE - Eh 100% dikhega
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF00C853))
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("VERSION 25 - BILKUL NAVA", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("V24 da code 0% - Sab nava", color = Color.White, fontSize = 12.sp)
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        LazyColumn(modifier = Modifier.weight(1f)) {
            items(messages) { msg ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (msg.isUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Text(msg.text, modifier = Modifier.padding(12.dp))
                }
            }
            if (isLoading) {
                item { Text("AI soch reha hai... V25", modifier = Modifier.padding(8.dp)) }
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = question,
                onValueChange = { question = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Sawal likho...") }
            )
            Button(
                onClick = {
                    if (question.isNotBlank() && !isLoading) {
                        val q = question
                        messages = messages + ChatMsg(q, true)
                        question = ""
                        isLoading = true
                        CoroutineScope(Dispatchers.IO).launch {
                            val ans = getV25Answer(q)
                            withContext(Dispatchers.Main) {
                                messages = messages + ChatMsg(ans, false)
                                isLoading = false
                            }
                        }
                    }
                }
            ) { Text("Send") }
        }
    }
}

data class ChatMsg(val text: String, val isUser: Boolean)

suspend fun getV25Answer(q: String): String {
    return try {
        val API_KEY = "APNI_GEMINI_API_KEY_ETHE_PAO"
        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$API_KEY")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        val prompt = "Tu UDC v25 AI hai. Short sahi answer de. Question: $q"
        val body = JSONObject().apply {
            put("contents", arrayOf(JSONObject().apply {
                put("parts", arrayOf(JSONObject().apply { put("text", prompt) }))
            }))
        }
        conn.outputStream.write(body.toString().toByteArray())
        val res = conn.inputStream.bufferedReader().readText()
        JSONObject(res).getJSONArray("candidates").getJSONObject(0)
            .getJSONObject("content").getJSONArray("parts").getJSONObject(0).getString("text")
    } catch (e: Exception) { "Error: ${e.message}" }
}
