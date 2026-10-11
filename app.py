import streamlit as st
import pandas as pd
from rapidfuzz import process, fuzz

st.set_page_config(page_title="UDC Number Finder", page_icon="📚", layout="centered")

st.title("📚 UDC Number Finder")
st.write("Enter a book or document title to find its UDC number.")

@st.cache_data
def load_data():
    # CSV file load karo
    df = pd.read_csv("udc_data.csv")
    
    # Sirf oh rows rakho jinne valid number te topic ne
    # Number wala column: sirf digits te dots
    df = df[df['Number'].astype(str).str.match(r'^[0-9.]+$', na=False)]
    
    # Topic wala column: khali nahi hona chahida te 3 ton vade chars
    df = df[df['Topic'].astype(str).str.len() > 3]
    
    # Duplicate hatao
    df = df.drop_duplicates(subset=['Topic'])
    
    # Index reset karo
    df = df.reset_index(drop=True)
    
    return df

df = load_data()

st.write(f"*Total {len(df)} UDC entries loaded*")

query = st.text_input("Enter Book/Document Title:", "")

if query:
    query = query.strip()
    
    # Fuzzy matching with WRatio (better accuracy)
    results = process.extract(
        query,
        df['Topic'].tolist(),
        scorer=fuzz.WRatio,
        limit=3
    )
    
    if results and results[0][1] > 40:
        st.success("**Top Matches:**")
        
        for topic, score, index in results:
            if score > 40:
                row = df.iloc[index]
                st.info(f"**UDC Number:** {row['Number']}  \n**Topic:** {row['Topic']}  \nMatch Score: {round(score, 1)}%")
    else:
        st.warning("No match found. Please try with a different title.")
