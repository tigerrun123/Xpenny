from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


DEFAULT_TIMEOUT_SECONDS = 30


def call_openclaw(message: str, agent: str = "main") -> dict[str, Any]:
    """Send a message to the configured OpenClaw HTTP endpoint."""
    if not message.strip():
        return {
            "ok": False,
            "error": "message must not be empty",
        }

    openclaw_url = os.getenv("OPENCLAW_URL")
    if not openclaw_url:
        return {
            "ok": True,
            "reply": "OpenClaw bridge not configured yet.",
        }

    payload = {
        "message": message,
        "agent": agent or "main",
        "source": "google-adk",
    }
    request = urllib.request.Request(
        openclaw_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            response_text = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        return {
            "ok": False,
            "error": f"OpenClaw returned HTTP {exc.code}",
            "details": error_text,
        }
    except urllib.error.URLError as exc:
        return {
            "ok": False,
            "error": "Could not reach OpenClaw",
            "details": str(exc.reason),
        }
    except TimeoutError:
        return {
            "ok": False,
            "error": f"OpenClaw request timed out after {DEFAULT_TIMEOUT_SECONDS} seconds",
        }

    reply = _extract_reply(response_text)
    return {
        "ok": True,
        "reply": reply,
    }


def _extract_reply(response_text: str) -> Any:
    if not response_text:
        return ""

    try:
        response_json = json.loads(response_text)
    except json.JSONDecodeError:
        return response_text

    if isinstance(response_json, dict):
        for key in ("reply", "message", "response", "output", "text"):
            if key in response_json:
                return response_json[key]

    return response_json
