# UDC AI V28

Render-ready UDC classifier based on the supplied B.S. 1000A:1961 Abridged English UDC reference.

## Render
Build Command:
`npm install`

Start Command:
`npm start`

Environment Variable:
`GEMINI_API_KEY` = your existing Gemini API key

Optional:
`GEMINI_MODEL` defaults to `gemini-3.8-flash`.

The server locally searches the supplied `udc_reference.txt` for title-related UDC schedule evidence and sends the relevant extracts to Gemini. The prompt explicitly prohibits DDC and prohibits inventing unverified notation.

Important: This is not a guarantee of perfect classification. A book title alone may be insufficient; the supplied UDC source itself says classifiers should inspect the document, synopsis/contents and text rather than rely on the title alone.
