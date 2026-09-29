package com.udc.app.v26

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// VERSION 26 - FINAL VADIA VERSION - 100% SHOW HOVEGA
// Eh XML wala hai, Compose da chakkar khatam, pakka chalega

class MainActivity : AppCompatActivity() {

    private val API_KEY = "APNI_GEMINI_API_KEY_ETHE_PAO"
    private val GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="

    private lateinit var questionInput: EditText
    private lateinit var answerView: TextView
    private lateinit var askButton: Button
    private lateinit var copyButton: Button
    private lateinit var versionBadge: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        questionInput = findViewById(R.id.questionInput)
        answerView = findViewById(R.id.answerView)
        askButton = findViewById(R.id.askButton)
        copyButton = findViewById(R.id.copyButton)
        versionBadge = findViewById(R.id.versionBadge)

        // VERSION 26 SHOW BADGE - Eh pakka dikhega
        versionBadge.text = "VERSION 26 - LATEST - UDC AI"

        askButton.setOnClickListener {
            val question = questionInput.text.toString().trim()
            if (question.isNotEmpty()) {
                answerView.text = "V26 soch reha hai... \nSahi answer labh reha haan..."
                getUDCAnswerV26(question)
            } else {
                Toast.makeText(this, "Pehla sawal likho veer", Toast.LENGTH_SHORT).show()
            }
        }

        copyButton.setOnClickListener {
            val text = answerView.text.toString()
            if (text.isNotEmpty() && !text.contains("ethe aayega")) {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("UDC Answer", text))
                Toast.makeText(this, "Answer Copy ho gaya!", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun getUDCAnswerV26(userQuestion: String) {
        val finalPrompt = """
            Tu UDC Version 26 AI hai. Tu India de UDC exam da top expert hai.
            Syllabus: GK, Reasoning, Maths, English, Hindi, Computer.
            Tenu sirf sahi, short, exam wangu answer dena hai.
            Koi option nahi, koi extra bakwas nahi.
            Agar maths hai ta step nal samjha.
            Answer clear te point-to-point de.
            
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
                    answerView.text = "V26 Error: ${e.message}\n\n1. API Key check kar\n2. Internet check kar"
                }
            }
        }
    }
}
