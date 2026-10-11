import streamlit as st
import pandas as pd
from rapidfuzz import process, fuzz

st.set_page_config(page_title="UDC Number Finder", page_icon="📚")

st.title("📚 UDC Number Finder")
st.write("Enter a book or document title to find its UDC number.")

@st.cache_data
def load_data():
    df = pd.read_csv("udc_data.csv")
    return df

df = load_data()

query = st.text_input("Enter Book/Document Title:", "")

if query:
    best_match = process.extractOne(
        query,
        df['Topic'].tolist(),
        scorer=fuzz.token_set_ratio
    )
    
    if best_match:
        matched_topic = best_match[0]
        score = best_match[1]
        matched_row = df[df['Topic'] == matched_topic].iloc[0]
        
        st.success(f"*UDC Number:* {matched_row['Number']}")
        st.info(f"*Topic:* {matched_topic}")
        st.caption(f"Match Score: {score}%")
    else:
        st.warning("No match found. Please try again.")