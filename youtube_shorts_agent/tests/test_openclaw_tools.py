from __future__ import annotations

import json
from contextlib import contextmanager
from io import BytesIO

from youtube_shorts_agent import openclaw_tools
from youtube_shorts_agent.openclaw_tools import call_openclaw


def test_call_openclaw_posts_expected_payload(monkeypatch):
    received = {}

    @contextmanager
    def fake_urlopen(request, timeout):
        received["url"] = request.full_url
        received["timeout"] = timeout
        received["payload"] = json.loads(request.data.decode("utf-8"))
        yield BytesIO(json.dumps({"reply": "OpenClaw says hello"}).encode("utf-8"))

    monkeypatch.setenv("OPENCLAW_URL", "https://openclaw.example.test/bridge")
    monkeypatch.setattr(openclaw_tools.urllib.request, "urlopen", fake_urlopen)
    result = call_openclaw("hello", agent="research")

    assert received["url"] == "https://openclaw.example.test/bridge"
    assert received["timeout"] == openclaw_tools.DEFAULT_TIMEOUT_SECONDS
    assert received["payload"] == {
        "message": "hello",
        "agent": "research",
        "source": "google-adk",
    }
    assert result == {
        "ok": True,
        "reply": "OpenClaw says hello",
    }


def test_call_openclaw_returns_mock_reply_without_url(monkeypatch):
    monkeypatch.delenv("OPENCLAW_URL", raising=False)

    result = call_openclaw("hello")

    assert result == {
        "ok": True,
        "reply": "OpenClaw bridge not configured yet.",
    }
