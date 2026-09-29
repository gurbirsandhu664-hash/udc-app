// onCreate 
CoroutineScope(Dispatchers.IO).launch {
    try {
        val configJson = URL("$SERVER_URL/api/config").readText()
        val versionBadgeText = JSONObject(configJson).getString("versionBadge")
        withContext(Dispatchers.Main){
            versionBadge.text = versionBadgeText // 
        }
    } catch(e:Exception){}
}
