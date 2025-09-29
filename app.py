import os
import json
from pathlib import Path
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load .env from the same directory as this file (robust on Windows/OneDrive)
env_path = Path(__file__).with_name('.env')
load_dotenv(dotenv_path=env_path, override=True)

# --- Config ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment")
genai.configure(api_key=GEMINI_API_KEY)

try:
    # Make sure this path is correct
    with open('data.json', 'r', encoding='utf-8') as f:
        translations = json.load(f)
except Exception as e:
    raise RuntimeError(f"Could not load or parse data.json: {e}")

# --- Flask App ---
app = Flask(__name__)

PROMPT_TEMPLATE = """
You are a chatbot assistant on a personal portfolio website. Your role is to answer questions about the site owner ONLY.
- Answer based ONLY on the KNOWLEDGE BASE provided. Do not invent information.
- Respond in the language specified in "LANGUAGE".
- If the question is unrelated or cannot be answered from the data, politely decline.
- Keep answers concise and natural.
---
KNOWLEDGE BASE: {knowledge_data}
---
LANGUAGE: {language}
---
USER'S QUESTION: {user_question}
---
YOUR ANSWER:
"""

@app.context_processor
def inject_translations():
    # This makes the 'translations' dict available to all templates as 'T'
    return dict(T=translations)

def get_lang_from_request():
    # Centralized function to get and validate language
    lang = request.args.get('lang', 'th')
    if lang not in translations:
        return 'th' # Default to Thai if language is invalid
    return lang

@app.route('/')
def index():
    lang = get_lang_from_request()
    return render_template('index.html', lang=lang)

@app.route('/blog')
def blog():
    lang = get_lang_from_request()
    return render_template('blog.html', lang=lang)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_question = data.get('message')
        lang = data.get('lang', 'th') # Get lang from chat's JSON body
        
        # Make sure the requested lang exists in our translations
        if lang not in translations:
            lang = 'th'
        
        context_data = translations[lang]
        
        prompt = PROMPT_TEMPLATE.format(
            knowledge_data=json.dumps(context_data, ensure_ascii=False, indent=2),
            language=lang,
            user_question=user_question
        )

        model = genai.GenerativeModel('gemini-flash-lite-latest')
        response = model.generate_content(prompt)
        
        return jsonify({"reply": response.text})

    except Exception as e:
        print(f"Error in /chat: {e}")
        return jsonify({"error": "Server error"}), 500

if __name__ == '__main__':
    # Using a different port just in case
    app.run(debug=True, port=5001)