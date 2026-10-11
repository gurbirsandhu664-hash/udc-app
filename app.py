"""
app.py
UDC Finder - Hybrid Classifier (TF-IDF + BM25)
Single file. Everything included.
"""

import os
import re
import pandas as pd
import streamlit as st
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ==========================================
# CONFIG
# ==========================================

CSV_FILE = "udc_data.csv"
TOP_K = 10
FINAL_K = 5

st.set_page_config(
    page_title="UDC Finder",
    page_icon="📚",
    layout="centered"
)

# ==========================================
# 1. CLEANING FUNCTIONS
# ==========================================

def clean_topic(topic):
    if not isinstance(topic, str):
        return ""
    topic = re.sub(r'\[.*?\]', '', topic)
    topic = re.sub(r'\s+\d+(-\d+)?\s*$', '', topic)
    topic = re.sub(r'\.+\s*$', '', topic)
    topic = re.sub(r'\s+', ' ', topic)
    return topic.strip().strip('"').strip("'").strip()

def clean_number(number):
    if not isinstance(number, str):
        return ""
    number = number.strip().strip('"').strip("'")
    if not re.match(r'^[\d\.\(\):\-]+$', number):
        return ""
    return number

# ==========================================
# 2. LOAD + SETUP SYSTEM
# ==========================================

@st.cache_resource
def setup_system():
    if not os.path.exists(CSV_FILE):
        return None, None, None, None, 0

    df = pd.read_csv(CSV_FILE, encoding="utf-8")
    df["Number"] = df["Number"].apply(clean_number)
    df["Topic"] = df["Topic"].apply(clean_topic)
    df = df[(df["Number"] != "") & (df["Topic"] != "")]
    df = df.drop_duplicates(subset=["Number"], keep="first")

    if len(df) == 0:
        return None, None, None, None, 0

    topics = df["Topic"].tolist()

    vectorizer = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 3),
        stop_words='english',
        min_df=1
    )
    tfidf_matrix = vectorizer.fit_transform(topics)

    corpus = [re.findall(r'\w+', t.lower()) for t in topics]
    bm25 = BM25Okapi(corpus)

    metadata = df.to_dict("records")
    return vectorizer, tfidf_matrix, bm25, metadata, len(df)

# ==========================================
# 3. SEARCH FUNCTIONS
# ==========================================

def search_tfidf(vectorizer, tfidf_matrix, metadata, query, top_k=TOP_K):
    qv = vectorizer.transform([query])
    scores = cosine_similarity(qv, tfidf_matrix).flatten()
    top_idx = scores.argsort()[::-1][:top_k]
    results = []
    for rank, idx in enumerate(top_idx, 1):
        if scores[idx] > 0:
            results.append({
                "number": metadata[idx]["Number"],
                "topic": metadata[idx]["Topic"],
                "rank": rank,
                "score": float(scores[idx])
            })
    return results

def search_bm25(bm25, metadata, query, top_k=TOP_K):
    tokens = re.findall(r'\w+', query.lower())
    if not tokens:
        return []
    scores = bm25.get_scores(tokens)
    top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
    results = []
    for rank, idx in enumerate(top_idx, 1):
        if scores[idx] > 0:
            results.append({
                "number": metadata[idx]["Number"],
                "topic": metadata[idx]["Topic"],
                "rank": rank,
                "score": float(scores[idx])
            })
    return results

def rrf_fusion(vec_results, bm_results, k=60):
    fused = {}
    all_items = {}
    for r in vec_results:
        key = r["number"]
        fused[key] = fused.get(key, 0) + 1 / (k + r["rank"])
        all_items[key] = r
    for r in bm_results:
        key = r["number"]
        fused[key] = fused.get(key, 0) + 1 / (k + r["rank"])
        all_items[key] = r
    sorted_items = sorted(fused.items(), key=lambda x: x[1], reverse=True)
    results = []
    for number, score in sorted_items:
        item = all_items[number].copy()
        item["confidence"] = round(min(score * 1000, 100), 2)
        results.append(item)
    return results

# ==========================================
# 4. HYBRID CLASSIFY
# ==========================================

def hybrid_classify(vectorizer, tfidf_matrix, bm25, metadata, title, top_k=FINAL_K):
    vec = search_tfidf(vectorizer, tfidf_matrix, metadata, title)
    bm = search_bm25(bm25, metadata, title)
    fused = rrf_fusion(vec, bm)
    return fused[:top_k]

# ==========================================
# 5. STREAMLIT UI
# ==========================================

st.title("UDC Finder")
st.caption("Hybrid Search: TF-IDF + BM25")

with st.spinner("Loading system..."):
    vectorizer, tfidf_matrix, bm25, metadata, total = setup_system()

    if metadata is None:
        st.error(f"{CSV_FILE} not found or empty!")
        st.stop()

    st.success(f"{total} entries ready")

title = st.text_input("Book/Document Title:", placeholder="e.g., Electronics")

if st.button("Classify", type="primary", use_container_width=True):
    if not title.strip():
        st.warning("Please enter a title!")
    else:
        with st.spinner("Searching..."):
            results = hybrid_classify(vectorizer, tfidf_matrix, bm25, metadata, title)

        if not results:
            st.error("No match found.")
        else:
            top = results[0]
            st.subheader("Best Match")

            col1, col2 = st.columns(2)
            with col1:
                st.metric("UDC Number", top["number"])
            with col2:
                st.metric("Confidence", f"{top['confidence']}%")

            st.write(f"*Topic:* {top['topic']}")

            if len(results) > 1:
                st.subheader("Alternatives")
                for r in results[1:]:
                    st.write(f"- UDC *{r['number']}* - {r['topic']} ({r['confidence']}%)")

st.markdown("---")
st.caption("Works on mobile too via same WiFi")
