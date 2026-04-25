import google.generativeai as genai
from openai import OpenAI

from config.settings import GEMINI_API_KEY, LLM_MODEL, LLM_PROVIDER, OPENAI_API_KEY


def _build_prompt(query: str, chunks: list[dict]) -> str:
    context = "\n\n".join(
        [f"[Source: {c['source_file']}, Page {c['page_num']}]\n{c['text']}" for c in chunks]
    )
    return f"""You are a helpful medical information assistant.
Use ONLY the context below to answer the question.
If the answer is not in the context, say: "I don't have enough information to answer this."
Never diagnose. Always recommend a doctor for personal medical decisions.

CONTEXT:
{context}

QUESTION: {query}

ANSWER:"""


def answer_with_context(query: str, chunks: list[dict]) -> str:
    prompt = _build_prompt(query, chunks)

    if LLM_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is missing")
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(LLM_MODEL)
        response = model.generate_content(prompt)
        return (response.text or "").strip()

    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is missing")
    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.responses.create(model=LLM_MODEL, input=prompt)
    return (response.output_text or "").strip()
