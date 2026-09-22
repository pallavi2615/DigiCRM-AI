import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import requests

from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI"])


class AIMessage(BaseModel):
    role: str
    content: str


class AIChatRequest(BaseModel):
    messages: list[AIMessage]


@router.post("/chat")
def ai_chat(
    request: AIChatRequest,
    user: User = Depends(get_current_user),
):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured",
        )

    try:
        response = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "model": "gemini-3.6-flash",
                "input": [
                    {
                        "type": "text",
                        "text": message.content,
                    }
                    for message in request.messages
                    if message.role != "system"
                ],
                "system_instruction": (
                    "You are DigiCRM AI, an expert sales assistant. "
                    "Help users manage leads, draft outreach emails, "
                    "analyze pipelines, and give concise, actionable "
                    "sales guidance. Be professional and friendly."
                ),
                "generation_config": {
                    "thinking_level": "low",
                },
            },
            timeout=60,
        )

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to AI service",
        )

    if response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="The AI assistant is busy right now. Please try again.",
        )

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=500,
            detail="Gemini API key is invalid",
        )

    if not response.ok:
        raise HTTPException(
            status_code=500,
            detail="AI request failed",
        )

    data = response.json()

    model_output = next(
        (
            step
            for step in data.get("steps", [])
            if step.get("type") == "model_output"
        ),
        None,
    )

    content = ""

    if model_output:
        output_content = model_output.get("content", [])

        if output_content:
            content = output_content[0].get("text", "")

    return {
        "content": content,
        "grounded": False,
    }