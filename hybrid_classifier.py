"""
hybrid_classifier.py
Hybrid UDC Classifier: TF-IDF + BM25
"""



import os
import re
import pandas as pd
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# ==========================================
# CONFIG
# ==========================================

CSV_FILE = "udc_data.csv"
TOP_K = 10
FINAL_K = 5

# ==========================================
# 1. CLEANING
# ==========================================

def clean_topic(topic):
    if not isinstance(topic, str):
        return ""
    topic = re.sub(r'\[.*?\]', '', topic)
    topic = re.sub(r'\s+\d+(-\d+)?\s*$', '', topic)
    topic = re.sub(r'\.+\s*$', '', topic)
    topic = re.sub(r'\s+', ' ', topic)
    topic = topic.strip().strip('"').strip("'")
    return topic.strip()

def clean_number(number):
    if not isinstance(number, str):
        return ""
    number = number.strip().strip('"').strip("'")
    if not re.match(r'^[\d\.\(\):\-]+$', number):
        return ""
    return number

def load_and_clean_csv():
    if not os.path.exists(CSV_FILE):
        print(f"❌ {CSV_FILE} nahi mili!")
        return None
    print(f"📖 {CSV_FILE} padh reha haan...")
    df = pd.read_csv(CSV_FILE, encoding="utf-8")
    print(f"   Original rows: {len(df)}")
    if "Number" not in df.columns or "Topic" not in df.columns:
        print("❌ CSV vich 'Number' te 'Topic' columns chahide ne.")
        return None
    df["Number"] = df["Number"].apply(clean_number)
    df["Topic"] = df["Topic"].apply(clean_topic)
    df = df[df["Number"] != ""]
    df = df[df["Topic"] != ""]
    df = df.drop_duplicates(subset=["Number"], keep="first")
    print(f"   Clean rows: {len(df)}")
    return df

# ==========================================
# 2. SETUP TF-IDF + BM25
# ==========================================

def setup_system(df):
    print("\n🔨 TF-IDF + BM25 bana reha haan...")
    
    topics = df["Topic"].tolist()
    
    # TF-IDF (Vector search)
    vectorizer = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 3),
        stop_words='english',
        min_df=1
    )
    tfidf_matrix = vectorizer.fit_transform(topics)
    
    # BM25 (Keyword search)
    corpus = [re.findall(r'\w+', t.lower()) for t in topics]
    bm25 = BM25Okapi(corpus)
    
    metadata = df.to_dict("records")
    
    print(f"✅ {len(topics)} entries ready.")
    return vectorizer, tfidf_matrix, bm25, metadata

# ==========================================
# 3. SEARCH
# ==========================================

def search_tfidf(vectorizer, tfidf_matrix, metadata, query, top_k=TOP_K):
    query_vec = vectorizer.transform([query])
    scores = cosine_similarity(query_vec, tfidf_matrix).flatten()
    top_idx = scores.argsort()[::-1][:top_k]
    results = []
    for rank, idx in enumerate(top_idx, 1):
        if scores[idx] <= 0:
            continue
        results.append({
            "number": metadata[idx]["Number"],
            "topic": metadata[idx]["Topic"],
            "rank": rank,
            "score": float(scores[idx])
        })
    return results

def search_bm25(bm25, metadata, query, top_k=TOP_K):
    query_tokens = re.findall(r'\w+', query.lower())
    if not query_tokens:
        return []
    scores = bm25.get_scores(query_tokens)
    top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
    results = []
    for rank, idx in enumerate(top_idx, 1):
        if scores[idx] <= 0:
            continue
        results.append({
            "number": metadata[idx]["Number"],
            "topic": metadata[idx]["Topic"],
            "rank": rank,
            "score": float(scores[idx])
        })
    return results

# ==========================================
# 4. RRF FUSION
# ==========================================

def reciprocal_rank_fusion(vector_results, bm25_results, k=60):
    fused = {}
    all_items = {}
    for r in vector_results:
        key = r["number"]
        fused[key] = fused.get(key, 0) + 1 / (k + r["rank"])
        all_items[key] = r
    for r in bm25_results:
        key = r["number"]
        fused[key] = fused.get(key, 0) + 1 / (k + r["rank"])
        all_items[key] = r
    sorted_items = sorted(fused.items(), key=lambda x: x[1], reverse=True)
    results = []
    for number, rrf_score in sorted_items:
        item = all_items[number].copy()
        item["rrf_score"] = round(rrf_score, 6)
        item["confidence"] = round(min(rrf_score * 1000, 100), 2)
        results.append(item)
    return results

# ==========================================
# 5. HYBRID CLASSIFY
# ==========================================

def hybrid_classify(vectorizer, tfidf_matrix, bm25, metadata, title, top_k=FINAL_K):
    tfidf_res = search_tfidf(vectorizer, tfidf_matrix, metadata, title, top_k=TOP_K)
    bm25_res = search_bm25(bm25, metadata, title, top_k=TOP_K)
    fused = reciprocal_rank_fusion(tfidf_res, bm25_res)
    return fused[:top_k], tfidf_res[:3], bm25_res[:3]

# ==========================================
# 6. PRINT
# ==========================================

def print_result(title, fused, tfidf_res, bm25_res):
    print("\n" + "=" * 70)
    print(f"📖 TITLE: {title}")
    print("=" * 70)
    if not fused:
        print("❌ Koi match nahi mila.")
        print("=" * 70 + "\n")
        return
    top = fused[0]
    conf = top["confidence"]
    if conf >= 80:
        status = "✅ HIGH CONFIDENCE"
    elif conf >= 50:
        status = "⚠️ MEDIUM CONFIDENCE"
    else:
        status = "❌ LOW CONFIDENCE"
    print(f"\n🏆 BEST MATCH:")
    print(f"   UDC Number : {top['number']}")
    print(f"   Topic      : {top['topic']}")
    print(f"   Confidence : {conf}%  {status}")
    if len(fused) > 1:
        print(f"\n📋 ALTERNATIVES:")
        for i, m in enumerate(fused[1:], 2):
            print(f"   {i}. UDC {m['number']} — {m['topic']} ({m['confidence']}%)")
    print(f"\n🔍 TF-IDF (Vector):")
    for i, m in enumerate(tfidf_res, 1):
        print(f"   {i}. UDC {m['number']} — {m['topic']} ({round(m['score'], 3)})")
    print(f"\n🔍 BM25 (Keyword):")
    for i, m in enumerate(bm25_res, 1):
        print(f"   {i}. UDC {m['number']} — {m['topic']} ({round(m['score'], 3)})")
    print("=" * 70 + "\n")

# ==========================================
# 7. MAIN
# ==========================================

def main():
    print("=" * 70)
    print("📚 HYBRID UDC CLASSIFIER (TF-IDF + BM25)")
    print("=" * 70)
    df = load_and_clean_csv()
    if df is None or len(df) == 0:
        return
    vectorizer, tfidf_matrix, bm25, metadata = setup_system(df)
    print("\n" + "=" * 70)
    print("Hun title likho (exit likho band karan layi)")
    print("=" * 70)
    while True:
        title = input("\n📖 Book Title: ").strip()
        if title.lower() in ("exit", "quit", ""):
            print("Bye!")
            break
        print("⏳ Search kar reha haan...")
        fused, tfidf_res, bm25_res = hybrid_classify(vectorizer, tfidf_matrix, bm25, metadata, title)
        print_result(title, fused, tfidf_res, bm25_res)

if __name__ == "__main__":
    main()