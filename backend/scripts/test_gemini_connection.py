from dotenv import load_dotenv
from google import genai
import os
import traceback

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
models = [
    os.getenv("GEMINI_MODEL"),
    os.getenv("GEMINI_FALLBACK_MODEL"),
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]

print("GEMINI_API_KEY loaded:", bool(api_key))
print("Models to test:", models)

client = genai.Client(api_key=api_key)

for model in models:
    if not model:
        continue

    print("\n" + "=" * 80)
    print(f"Testing model: {model}")

    try:
        response = client.models.generate_content(
            model=model,
            contents="Return only this JSON: {\"score\": 80, \"feedback\": \"ok\"}",
        )

        print("SUCCESS")
        print("Response text:")
        print(response.text)

    except Exception as exc:
        print("FAILED")
        print(type(exc).__name__)
        print(str(exc))
        print(traceback.format_exc())