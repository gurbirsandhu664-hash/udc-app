import os
import re
import pandas as pd
import streamlit as st
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

CSV_FILE = "udc_data.csv"
TOP_K = 10
FINAL_K = 5

st.set_page_config(page_title="UDC/DDC Finder", page_icon="📚", layout="centered")

# ==============================================================================
# MANUAL DICTIONARY (100% Accurate)
# ==============================================================================

MANUAL_UDC = {
    # Languages (UDC Language Auxiliary = )
    "punjabi": "=214.2",
    "punjabi language": "=214.2",
    "punjabi literature": "821.214.2",
    "hindi": "=214",
    "hindi language": "=214",
    "hindi literature": "821.214",
    "urdu": "=214.1",
    "urdu language": "=214.1",
    "urdu literature": "821.214.1",
    "bengali": "=214.3",
    "bengali language": "=214.3",
    "tamil": "=214.4",
    "tamil language": "=214.4",
    "telugu": "=214.5",
    "marathi": "=214.6",
    "gujarati": "=214.7",
    "sanskrit": "=211",
    "sanskrit language": "=211",
    "english": "=111",
    "english language": "=111",
    "english literature": "821.111",
    "french": "=133.1",
    "french language": "=133.1",
    "german": "=112.2",
    "german language": "=112.2",
    "arabic": "=411",
    "arabic language": "=411",
    "persian": "=411.1",
    "chinese": "=581",
    "japanese": "=582",

    # Science and Arts (Addition)
    "science and arts": "5+7",
    "science and art": "5+7",
    "arts and science": "5+7",
    "arts and sciences": "5+7",

    # Common Titles
    "information and control theory": "007",
    "history of india": "94(540)",
    "indian history": "94(540)",
    "management": "65",
    "electronics": "621.38",
    "library science": "02",
    "computer science": "004",
    "artificial intelligence": "004.8",
    "machine learning": "004.85",
    "deep learning": "004.85",
    "data science": "004.6",
    "cyber security": "004.7",
    "cloud computing": "004.7",
    "internet of things": "004.7",
    "software engineering": "004.4",
    "database management": "004.6",
    "operating systems": "004.4",
    "computer networks": "004.7",

    # Simple Subjects
    "physics": "53",
    "chemistry": "54",
    "biology": "57",
    "mathematics": "51",
    "medicine": "61",
    "engineering": "62",
    "agriculture": "63",
    "law": "34",
    "education": "37",
    "economics": "33",
    "history": "94",
    "geography": "91",
    "philosophy": "1",
    "religion": "2",
    "social sciences": "3",
    "language": "4",
    "arts": "7",
    "literature": "8",
}

# ==============================================================================
# COMMON AUXILIARIES
# ==============================================================================

LANGUAGE = {
    "english": "=111",
    "german": "=112.2",
    "french": "=133.1",
    "italian": "=131.1",
    "spanish": "=134.2",
    "portuguese": "=134.3",
    "russian": "=161.1",
    "hindi": "=214",
    "urdu": "=214.1",
    "punjabi": "=214.2",
    "bengali": "=214.3",
    "sanskrit": "=211",
    "arabic": "=411",
    "persian": "=411.1",
    "chinese": "=581",
    "japanese": "=582",
    "korean": "=583",
    "tamil": "=214.4",
    "telugu": "=214.5",
    "marathi": "=214.6",
    "gujarati": "=214.7",
}

FORM = {
    "bibliography": "(01)",
    "catalogue": "(017)",
    "dictionary": "(038)",
    "encyclopedia": "(031)",
    "handbook": "(035)",
    "manual": "(035)",
    "guide": "(036)",
    "textbook": "(075)",
    "thesis": "(043)",
    "dissertation": "(043)",
    "report": "(047)",
    "periodical": "(05)",
    "journal": "(05)",
    "atlas": "(084.4)",
    "map": "(084.3)",
    "patent": "(088)",
    "standard": "(083)",
    "yearbook": "(058)",
    "directory": "(058.7)",
    "biography": "(092)",
    "conference": "(063)",
    "proceedings": "(063)",
    "abstract": "(048)",
    "index": "(083.8)",
}

PLACE = {
    "india": "(540)",
    "pakistan": "(549)",
    "bangladesh": "(549.3)",
    "sri lanka": "(548.7)",
    "nepal": "(541.35)",
    "bhutan": "(541.31)",
    "england": "(410)",
    "britain": "(410)",
    "uk": "(410)",
    "scotland": "(411)",
    "ireland": "(417)",
    "wales": "(429)",
    "usa": "(73)",
    "america": "(73)",
    "united states": "(73)",
    "canada": "(71)",
    "mexico": "(72)",
    "brazil": "(81)",
    "china": "(510)",
    "japan": "(520)",
    "korea": "(519)",
    "germany": "(430)",
    "france": "(440)",
    "italy": "(450)",
    "spain": "(460)",
    "russia": "(470)",
    "ussr": "(47)",
    "australia": "(94)",
    "new zealand": "(931)",
    "africa": "(6)",
    "egypt": "(620)",
    "nigeria": "(669)",
    "europe": "(4)",
    "asia": "(5)",
    "north america": "(7)",
    "south america": "(8)",
    "punjab": "(540.1)",
    "delhi": "(540.2)",
    "mumbai": "(540.3)",
    "kolkata": "(540.4)",
    "chennai": "(540.5)",
    "hyderabad": "(540.6)",
    "bangalore": "(540.7)",
}

RACE = {
    "aryan": "(=1)",
    "germanic": "(=11)",
    "anglo-saxon": "(=111)",
    "romance": "(=13)",
    "semitic": "(=4)",
    "arab": "(=41)",
    "jew": "(=411)",
    "indo-aryan": "(=21)",
    "dravidian": "(=22)",
}

TIME = {
    "ancient": '"...01"',
    "medieval": '"...04"',
    "modern": '"...05"',
    "19th century": '"...18"',
    "20th century": '"...19"',
    "21st century": '"...20"',
    "prehistoric": '"...02"',
    "contemporary": '"...21"',
}

POINT_OF_VIEW = {
    "theory": ".001",
    "philosophy": ".01",
    "research": ".001.891",
    "history": ".001.891",
    "methodology": ".001.8",
    "study": ".001.8",
    "management": ".005",
    "design": ".001.7",
    "economy": ".003",
    "law": ".006",
    "politics": ".007",
}

MATERIALS = {
    "wood": "-035.5",
    "metal": "-034",
    "plastic": "-036",
    "glass": "-033",
    "paper": "-032",
    "leather": "-031",
    "cotton": "-037",
    "wool": "-037.2",
    "silk": "-037.3",
    "steel": "-034.1",
    "iron": "-034.2",
    "copper": "-034.3",
    "aluminium": "-034.4",
    "rubber": "-036.5",
}

SPECIAL_AUX = {
    "analysis": "-1",
    "synthesis": "-2",
    "design": "-4",
    "operation": "-5",
    "tools": "-7",
    "materials": "-8",
    "research": ".01",
    "management": ".02",
    "planning": ".03",
    "marketing": ".04",
    "production": ".05",
    "maintenance": ".06",
    "quality": ".07",
    "testing": ".08",
    "safety": ".09",
}

RELATION_KEYWORDS = [" and ", " in ", " for ", " with ", " between ", " among "]
ADDITION_KEYWORDS = [" plus ", " + ", " also "]
EXTENSION_KEYWORDS = [" to ", " through ", " range "]
GROUPING_KEYWORDS = [" general ", " overall ", " combined "]
SUBGROUPING_KEYWORDS = [" sub ", " specific ", " detailed "]

# ==============================================================================
# CLEANING
# ==============================================================================

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
    if not re.match(r'^[\d\.\(\):\-\+\/\[\]"=]', number):
        return ""
    return number

# ==============================================================================
# SETUP SYSTEM
# ==============================================================================

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
    vectorizer = TfidfVectorizer(lowercase=True, ngram_range=(1, 3), stop_words='english', min_df=1)
    tfidf_matrix = vectorizer.fit_transform(topics)
    corpus = [re.findall(r'\w+', t.lower()) for t in topics]
    bm25 = BM25Okapi(corpus)
    metadata = df.to_dict("records")
    return vectorizer, tfidf_matrix, bm25, metadata, len(df)

# ==============================================================================
# SEARCH
# ==============================================================================

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

def hybrid_classify(vectorizer, tfidf_matrix, bm25, metadata, title, top_k=FINAL_K):
    vec = search_tfidf(vectorizer, tfidf_matrix, metadata, title)
    bm = search_bm25(bm25, metadata, title)
    fused = rrf_fusion(vec, bm)
    return fused[:top_k]

# ==============================================================================
# AUXILIARIES DETECTOR
# ==============================================================================

def detect_auxiliaries(title):
    title_lower = title.lower()
    aux = {
        "language": None,
        "form": None,
        "place": None,
        "race": None,
        "time": None,
        "point_of_view": None,
        "materials": None,
        "relation": False,
        "addition": False,
        "extension": False,
        "grouping": False,
        "subgrouping": False,
        "special": None,
        "az": None,
    }

    for k, v in LANGUAGE.items():
        if k in title_lower:
            aux["language"] = v
            break
    for k, v in FORM.items():
        if k in title_lower:
            aux["form"] = v
            break
    for k, v in PLACE.items():
        if k in title_lower:
            aux["place"] = v
            break
    for k, v in RACE.items():
        if k in title_lower:
            aux["race"] = v
            break
    for k, v in TIME.items():
        if k in title_lower:
            aux["time"] = v
            break
    for k, v in POINT_OF_VIEW.items():
        if k in title_lower:
            aux["point_of_view"] = v
            break
    for k, v in MATERIALS.items():
        if k in title_lower:
            aux["materials"] = v
            break

    for kw in RELATION_KEYWORDS:
        if kw in title_lower:
            aux["relation"] = True
            break
    for kw in ADDITION_KEYWORDS:
        if kw in title_lower:
            aux["addition"] = True
            break
    for kw in EXTENSION_KEYWORDS:
        if kw in title_lower:
            aux["extension"] = True
            break
    for kw in GROUPING_KEYWORDS:
        if kw in title_lower:
            aux["grouping"] = True
            break
    for kw in SUBGROUPING_KEYWORDS:
        if kw in title_lower:
            aux["subgrouping"] = True
            break

    for k, v in SPECIAL_AUX.items():
        if k in title_lower:
            aux["special"] = v
            break

    words = title.split()
    if words:
        aux["az"] = "A/Z '" + words[0].capitalize() + "'"

    return aux

# ==============================================================================
# PROPER UDC BUILDER
# ==============================================================================

def build_proper_udc(results, title):
    if not results:
        return "No match", [], {}

    main = results[0]
    main_num = main["number"]
    top_results = [main]
    aux = detect_auxiliaries(title)

    if aux["addition"] and len(results) >= 2:
        for r in results[1:]:
            if r["number"] != main_num:
                main_num = main_num + "+" + r["number"]
                top_results.append(r)
                break
    elif aux["relation"] and len(results) >= 2:
        for r in results[1:]:
            if r["number"] != main_num:
                main_num = main_num + ":" + r["number"]
                top_results.append(r)
                break

    parts = [main_num]
    if aux["language"]:
        parts.append(aux["language"])
    if aux["form"]:
        parts.append(aux["form"])
    if aux["place"]:
        parts.append(aux["place"])
    if aux["race"]:
        parts.append(aux["race"])
    if aux["time"]:
        parts.append(aux["time"])
    if aux["point_of_view"]:
        parts.append(aux["point_of_view"])
    if aux["materials"]:
        parts.append(aux["materials"])
    if aux["special"]:
        parts.append(aux["special"])

    proper_udc = "".join(parts)
    if aux["az"]:
        proper_udc = proper_udc + " " + aux["az"]

    return proper_udc, top_results, aux

# ==============================================================================
# DDC BUILDER
# ==============================================================================

def build_ddc_number(main_number, title):
    DDC_SUBDIVISIONS = {
        "theory": "01",
        "philosophy": "01",
        "dictionary": "03",
        "encyclopedia": "03",
        "periodical": "05",
        "journal": "05",
        "organization": "06",
        "management": "068",
        "research": "072",
        "history": "09",
        "geography": "09",
        "biography": "092",
    }
    title_lower = title.lower()
    for k, v in DDC_SUBDIVISIONS.items():
        if k in title_lower:
            return main_number + "." + v
    return main_number

# ==============================================================================
# MAIN CLASSIFY
# ==============================================================================

def classify_title(title, vectorizer, tfidf_matrix, bm25, metadata):
    title_lower = title.lower().strip()

    if title_lower in MANUAL_UDC:
        return {
            "source": "Manual Dictionary",
            "proper_udc": MANUAL_UDC[title_lower],
            "ddc": "",
            "confidence": 100,
            "main_topic": "Manual entry",
            "auxiliaries": {},
            "alternatives": []
        }

    results = hybrid_classify(vectorizer, tfidf_matrix, bm25, metadata, title)
    if not results:
        return None

    proper_udc, top_results, aux = build_proper_udc(results, title)
    top = top_results[0]
    ddc_num = build_ddc_number(top["number"], title)

    return {
        "source": "Hybrid Search",
        "proper_udc": proper_udc,
        "ddc": ddc_num,
        "confidence": top["confidence"],
        "main_topic": top["topic"],
        "context_topic": top_results[1]["topic"] if len(top_results) > 1 else None,
        "auxiliaries": aux,
        "alternatives": results[1:5]
    }

# ==============================================================================
# STREAMLIT UI
# ==============================================================================

st.title("📚 UDC / DDC Finder")
st.caption("Professional Classifier — Sections A, B, C, D")

with st.spinner("Loading system..."):
    vectorizer, tfidf_matrix, bm25, metadata, total = setup_system()
    if metadata is None:
        st.error("CSV file not found or empty!")
        st.stop()
    st.success("✅ " + str(total) + " entries ready")

title = st.text_input("📖 Book/Document Title:", placeholder="e.g., Punjabi language, Science and Arts, Hindi")

if st.button("🔍 Classify", type="primary", use_container_width=True):
    if not title.strip():
        st.warning("Please enter a title!")
    else:
        with st.spinner("Searching..."):
            result = classify_title(title, vectorizer, tfidf_matrix, bm25, metadata)

        if not result:
            st.error("❌ No match found.")
        else:
            st.subheader("🏆 Best Match")

            col1, col2 = st.columns(2)
            with col1:
                st.metric("UDC Number", result["proper_udc"])
            with col2:
                st.metric("Confidence", str(result["confidence"]) + "%")

            if result.get("ddc"):
                st.metric("DDC Number", result["ddc"])

            st.write("**Source:** " + result["source"])
            st.write("**Main Topic:** " + result["main_topic"])

            if result.get("context_topic"):
                st.write("**Context:** " + result["context_topic"])

            aux = result.get("auxiliaries", {})
            labels = {
                "language": "Language",
                "form": "Form",
                "place": "Place",
                "race": "Race",
                "time": "Time",
                "point_of_view": "Point of View",
                "materials": "Materials",
                "special": "Special Auxiliary",
                "az": "A/Z",
            }
            for key, label in labels.items():
                if aux.get(key):
                    st.write("**" + label + ":** " + str(aux[key]))

            if result.get("alternatives"):
                st.subheader("📋 Alternatives")
                for r in result["alternatives"]:
                    st.write("- UDC **" + r["number"] + "** - " + r["topic"] + " (" + str(r["confidence"]) + "%)")

st.markdown("---")
st.caption("💡 Symbols: : Relation | + Addition | / Extension | [ ] Grouping | :: Subgrouping")
