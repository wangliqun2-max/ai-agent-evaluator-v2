import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests

load_dotenv()

app = Flask(__name__)
# Enable CORS for all routes (important for frontend to communicate)
CORS(app)

QWEN_API_KEY = os.getenv("QWEN_API_KEY")

if not QWEN_API_KEY:
    print("Warning: QWEN_API_KEY is not set in .env")

@app.route('/api/chat', methods=['POST'])
def chat():
    print("Received request at /api/chat")
    data = request.json
    if not data or 'messages' not in data:
        return jsonify({'error': 'No messages provided'}), 400

    messages = data['messages']
    
    if not QWEN_API_KEY:
        return jsonify({'error': 'QWEN_API_KEY is not configured in .env'}), 500
        
    try:
        qwen_response = requests.post(
            'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {QWEN_API_KEY}'
            },
            json={
                'model': 'qwen-plus',
                'messages': messages
            },
            timeout=30
        )
        
        if not qwen_response.ok:
            error_data = qwen_response.json()
            return jsonify({'error': f"Qwen API failed: {error_data.get('error', {}).get('message', 'Unknown Error')}"}), 500
            
        return jsonify(qwen_response.json())
        
    except Exception as qwen_e:
        print(f"Error calling Qwen: {qwen_e}")
        return jsonify({'error': f"Qwen failed: {str(qwen_e)}"}), 500

if __name__ == '__main__':
    app.run(port=3000, debug=True)
