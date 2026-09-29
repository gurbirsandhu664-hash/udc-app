package com.udc.app.fix

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * UDC FIX FILE - 3 Answer System Hata ke Direct AI Answer System
 * 1. Is file nu apni MainActivity.kt nal replace kar de
 * 2. Neeche API_KEY ch apni Gemini API Key pa de
 */

class MainActivity : AppCompatActivity() {

    private val API_KEY = "APNI_GEMINI_API_KEY_ETHE_PAO"
    private val GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="

    private lateinit var questionInput: EditText
    private lateinit var answerView: TextView
    private lateinit var askButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // 3 Answer wala purana system - HATA DITTA
        // val optionA = findViewById<RadioButton>(R.id.optionA) -> REMOVED
        // val optionB = findViewById<RadioButton>(R.id.optionB) -> REMOVED
        // val optionC = findViewById<RadioButton>(R.id.optionC) -> REMOVED

        // Nava Direct Answer System
        questionInput = findViewById(R.id.questionInput)
        answerView = findViewById(R.id.answerView)
        askButton = findViewById(R.id.askButton)

        askButton.setOnClickListener {
            val question = questionInput.text.toString()
            if (question.isNotEmpty()) {
                answerView.text = "Answer labh reha haan..."
                getUDCAnswer(question)
            }
        }
    }

    private fun getUDCAnswer(userQuestion: String) {
        // UDC layi Special Prompt - Sirf sahi answer devega
        val finalPrompt = """
            Tu ek UDC (Upper Division Clerk) exam ka expert hai.
            Tujhe UDC syllabus - General Knowledge, Reasoning, Maths, English, Hindi, Computer ke hisab se answer dena hai.
            Rules:
            1. Koi 3 option mat de, koi MCQ mat bana.
            2. Sirf seedha, sahi, short or 100% correct answer de.
            3. Agar calculation hai to step-by-step de.
            4. Answer Hindi/English mix me de jo UDC me chalta hai.
            
            Question: $userQuestion
        """.trimIndent()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL(GEMINI_URL + API_KEY)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true

                val jsonBody = JSONObject()
                val contents = JSONObject()
                val parts = JSONObject()
                parts.put("text", finalPrompt)
                contents.put("parts", arrayOf(parts))
                jsonBody.put("contents", arrayOf(contents))

                connection.outputStream.write(jsonBody.toString().toByteArray())

                val response = connection.inputStream.bufferedReader().readText()
                val jsonResponse = JSONObject(response)
                val answer = jsonResponse
                    .getJSONArray("candidates")
                    .getJSONObject(0)
                    .getJSONObject("content")
                    .getJSONArray("parts")
                    .getJSONObject(0)
                    .getString("text")

                withContext(Dispatchers.Main) {
                    answerView.text = answer
                }

            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    answerView.text = "Error: ${e.message}\nAPI Key check kar."
                }
            }
        }
    }
}
