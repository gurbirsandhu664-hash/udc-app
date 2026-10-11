import re
import json
import os
from rapidfuzz import fuzz, process

# ==========================================
# 1. DATA LOADING
# ==========================================

def load_json(filepath):
    """JSON file load karo, agar file na mile taan empty dict return karo"""
    if not os.path.exists(filepath):
        print(f"⚠️ Warning: {filepath} nahi mili. Empty data use kar reha haan.")
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

# Tuhade uploaded data da path
UDC_FILE = "UDC_1961.json"
DDC_FILE = "DDC_23.json"

UDC_RAW = load_json(UDC_FILE)
DDC_RAW = load_json(DDC_FILE)

# Data structure handle karo (chahe "UDC" key hove ya direct)
UDC_DATA = UDC_RAW.get("UDC", UDC_RAW)
DDC_DATA = DDC_RAW.get("DDC", DDC_RAW)


# ==========================================
# 2. TITLE PARSER (NLP)
# ==========================================

STOPWORDS = {
    "in", "the", "of", "and", "for", "on", "at", "with", "a", "an", "to",
    "from", "by", "is", "are", "was", "were", "be", "been", "being",
    "this", "that", "these", "those", "it", "its", "as", "or", "but",
    "not", "no", "nor", "so", "yet", "into", "onto", "upon", "about"
}

def parse_title(title):
    """Title nu lowercase karo, words torho, stopwords hatao"""
    title = title.lower().strip()
    # Sirf alphanumeric words rakho
    words = re.findall(r'\b[a-z0-9\.]+\b', title)
    filtered = [w for w in words if w not in STOPWORDS and len(w) > 1]
    return filtered

def extract_key_phrases(words):
    """Words nu phrases vich group karo (2-3 words de combinations)"""
    phrases = []
    # Single words
    phrases.extend(words)
    # 2-word phrases
    for i in range(len(words) - 1):
        phrases.append(f"{words[i]} {words[i+1]}")
    # 3-word phrases
    for i in range(len(words) - 2):
        phrases.append(f"{words[i]} {words[i+1]} {words[i+2]}")
    return phrases


# ==========================================
# 3. FUZZY MATCHING
# ==========================================

def find_matches(phrases, data, threshold=60, limit=5):
    """Phrases nu data naal match karo, score de hisaab naal sort karo"""
    matches = []
    if not data:
        return matches

    for number, info in data.items():
        title = info.get("title", "").lower()
        if not title:
            continue

        # Best score labho (phrases vichon)
        best_score = 0
        for phrase in phrases:
            # Token set ratio: word order te extra words nu ignore karda hai
            score = fuzz.token_set_ratio(phrase, title)
            if score > best_score:
                best_score = score

        if best_score >= threshold:
            matches.append({
                "number": number,
                "title": info.get("title", ""),
                "score": best_score,
                "notes": info.get("notes", "")
            })

    # Score de hisaab naal descending sort karo
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:limit]


# ==========================================
# 4. RULE ENGINE (UDC vs DDC)
# ==========================================

def build_udc_number(matches):
    """
    UDC Rules:
    - 1 subject: direct number
    - 2 subjects: colon ( : ) naal joro
    - 3+ subjects: top 2 nu colon naal joro
    """
    if not matches:
        return "No match", "No subject found"
    elif len(matches) == 1:
        return matches[0]["number"], matches[0]["title"]
    else:
        # Top 2 matches nu colon naal joro
        main_num = matches[0]["number"]
        context_num = matches[1]["number"]
        return f"{main_num}:{context_num}", f"{matches[0]['title']} : {matches[1]['title']}"


def build_ddc_number(matches):
    """
    DDC Rules:
    - 1 subject: direct number
    - 2 subjects: Table 1 (Standard Subdivisions) ya number combine
    - DDC vich colon nahi hunda
    """
    if not matches:
        return "No match", "No subject found"
    elif len(matches) == 1:
        return matches[0]["number"], matches[0]["title"]
    else:
        # DDC vich combine karan da simple tareeka:
        # Main number + context da last 2 digits (rough approximation)
        main_num = matches[0]["number"]
        context_num = matches[1]["number"]
        # Agar context number chhota hai, taan direct joro
        if len(context_num) <= 3:
            combined = f"{main_num}{context_num}"
        else:
            # Last 2 digits lao
            combined = f"{main_num}{context_num[-2:]}"
        return combined, f"{matches[0]['title']} for {matches[1]['title']}"


# ==========================================
# 5. VALIDATION
# ==========================================

def validate_number(number, data):
    """Check karo ki number data vich exist karda hai"""
    if number in data:
        return True, data[number].get("title", "")
    # Agar colon wala number hai, taan dono hisse check karo
    if ":" in number:
        parts = number.split(":")
        all_valid = all(p in data for p in parts)
        if all_valid:
            titles = [data[p].get("title", "") for p in parts]
            return True, " : ".join(titles)
    return False, "Not found in UDC/DDC schedules"


# ==========================================
# 6. CONFIDENCE SCORE
# ==========================================

def calculate_confidence(matches):
    """Confidence score calculate karo (0-100)"""
    if not matches:
        return 0.0
    scores = [m["score"] for m in matches]
    avg = sum(scores) / len(scores)
    # Top match da score zyada weight dinda hai
    top_weight = matches[0]["score"] * 0.7
    rest_weight = (avg * 0.3) if len(matches) > 1 else 0
    confidence = top_weight + rest_weight
    return round(min(confidence, 100), 2)


# ==========================================
# 7. EXPLANATION GENERATOR
# ==========================================

def generate_explanation(matches, system="UDC"):
    """User layi explanation banao"""
    if not matches:
        return "Koi subject match nahi hoya."

    lines = []
    lines.append(f"**{system} Breakdown:**")

    if len(matches) == 1:
        lines.append(f"- Main Subject: {matches[0]['title']} ({matches[0]['number']})")
    else:
        lines.append(f"- Main Subject: {matches[0]['title']} ({matches[0]['number']})")
        lines.append(f"- Context/Relation: {matches[1]['title']} ({matches[1]['number']})")
        if system == "UDC":
            lines.append(f"- Symbol: ':' (relation between two subjects)")
        else:
            lines.append(f"- Symbol: Table 1 / Standard Subdivision")

    if len(matches) > 2:
        lines.append(f"- Other possible matches: {', '.join(m['title'] for m in matches[2:])}")

    return "\n".join(lines)


# ==========================================
# 8. MAIN FUNCTION
# ==========================================

def get_classification(title):
    """Main function jo UDC te DDC dono da answer dinda hai"""
    words = parse_title(title)
    phrases = extract_key_phrases(words)

    # UDC Matches
    udc_matches = find_matches(phrases, UDC_DATA, threshold=60)
    udc_number, udc_title = build_udc_number(udc_matches)
    udc_valid, udc_valid_title = validate_number(udc_number, UDC_DATA)
    udc_confidence = calculate_confidence(udc_matches)

    # DDC Matches
    ddc_matches = find_matches(phrases, DDC_DATA, threshold=60)
    ddc_number, ddc_title = build_ddc_number(ddc_matches)
    ddc_valid, ddc_valid_title = validate_number(ddc_number, DDC_DATA)
    ddc_confidence = calculate_confidence(ddc_matches)

    return {
        "title": title,
        "UDC": {
            "number": udc_number,
            "title": udc_valid_title if udc_valid else udc_title,
            "confidence": udc_confidence,
            "valid": udc_valid,
            "explanation": generate_explanation(udc_matches, "UDC"),
            "all_matches": udc_matches
        },
        "DDC": {
            "number": ddc_number,
            "title": ddc_valid_title if ddc_valid else ddc_title,
            "confidence": ddc_confidence,
            "valid": ddc_valid,
            "explanation": generate_explanation(ddc_matches, "DDC"),
            "all_matches": ddc_matches
        }
    }


# ==========================================
# 9. PRETTY PRINT
# ==========================================

def print_result(result):
    """Result nu sundar tareeke naal print karo"""
    print("\n" + "=" * 60)
    print(f"📖 TITLE: {result['title']}")
    print("=" * 60)

    for system in ["UDC", "DDC"]:
        data = result[system]
        status = "✅ Valid" if data["valid"] else "❌ Invalid"
        print(f"\n🔹 {system} CLASSIFICATION")
        print(f"   Number     : {data['number']}")
        print(f"   Title      : {data['title']}")
        print(f"   Confidence : {data['confidence']}%")
        print(f"   Status     : {status}")
        print(f"   Explanation:")
        for line in data["explanation"].split("\n"):
            print(f"     {line}")

    print("\n" + "=" * 60 + "\n")


# ==========================================
# 10. TEST / RUN
# ==========================================

if __name__ == "__main__":
    test_titles = [
        "Document Selection in University Libraries",
        "Science and arts",
        "Information and control theory",
        "Library collection development in higher education",
        "History of India",
        "Research methodology in social sciences"
    ]

    for t in test_titles:
        result = get_classification(t)
        print_result(result)
