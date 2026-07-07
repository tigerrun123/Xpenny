from __future__ import annotations

import os
import re
import textwrap
from pathlib import Path
from typing import Literal

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "outputs"
DEFAULT_CLIENT_SECRETS = PROJECT_ROOT / "client_secret.json"
DEFAULT_TOKEN = PROJECT_ROOT / "youtube_token.json"
YOUTUBE_UPLOAD_SCOPE = ["https://www.googleapis.com/auth/youtube.upload"]


def generate_short_video(
    prompt: str,
    title: str = "AI Short",
    duration_seconds: int = 8,
    output_path: str | None = None,
) -> dict:
    """Create a simple 9:16 MP4 short from prompt text."""
    if not prompt.strip():
        raise ValueError("prompt must not be empty")

    duration_seconds = max(3, min(duration_seconds, 30))
    fps = 24
    width, height = 720, 1280
    frames = duration_seconds * fps
    OUTPUT_DIR.mkdir(exist_ok=True)

    target = Path(output_path) if output_path else OUTPUT_DIR / f"{_slugify(title)}.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)

    title_font = _load_font(66)
    body_font = _load_font(42)
    small_font = _load_font(28)
    title_lines = _wrap_text(title, 15)
    prompt_lines = _wrap_text(prompt, 24)[:8]

    with imageio.get_writer(
        target,
        fps=fps,
        codec="libx264",
        quality=8,
        macro_block_size=16,
        ffmpeg_log_level="error",
    ) as writer:
        for index in range(frames):
            progress = index / max(1, frames - 1)
            frame = _render_frame(
                width,
                height,
                progress,
                title_lines,
                prompt_lines,
                title_font,
                body_font,
                small_font,
            )
            writer.append_data(np.asarray(frame))

    return {
        "video_path": str(target),
        "duration_seconds": duration_seconds,
        "format": "mp4",
        "aspect_ratio": "9:16",
        "next_step": "Ask the user for upload confirmation, then call upload_video_to_youtube.",
    }


def upload_video_to_youtube(
    video_path: str,
    title: str,
    description: str = "",
    tags: list[str] | None = None,
    privacy_status: Literal["private", "unlisted", "public"] = "private",
    client_secrets_path: str | None = None,
    token_path: str | None = None,
    allow_browser_auth: bool = False,
) -> dict:
    """Upload an MP4 to YouTube using OAuth user credentials."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    path = Path(video_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Video not found: {path}")

    secrets = Path(client_secrets_path or os.getenv("YOUTUBE_CLIENT_SECRETS", DEFAULT_CLIENT_SECRETS))
    token_file = Path(token_path or os.getenv("YOUTUBE_TOKEN_PATH", DEFAULT_TOKEN))

    credentials = None
    if token_file.exists():
        credentials = Credentials.from_authorized_user_file(str(token_file), YOUTUBE_UPLOAD_SCOPE)

    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())

    if not credentials or not credentials.valid:
        if not secrets.exists():
            raise FileNotFoundError(
                "Missing YouTube OAuth client secret JSON. "
                f"Place it at {secrets} or set YOUTUBE_CLIENT_SECRETS."
            )
        if not allow_browser_auth:
            raise RuntimeError(
                "No valid YouTube OAuth token is available. "
                "Run scripts/youtube_oauth.py locally first, or retry with allow_browser_auth=True."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(secrets), YOUTUBE_UPLOAD_SCOPE)
        credentials = flow.run_local_server(port=0)
        token_file.write_text(credentials.to_json(), encoding="utf-8")

    youtube = build("youtube", "v3", credentials=credentials)
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags or ["shorts", "ai"],
            "categoryId": "22",
        },
        "status": {"privacyStatus": privacy_status},
    }

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=MediaFileUpload(str(path), chunksize=-1, resumable=True, mimetype="video/mp4"),
    )
    response = None
    while response is None:
        _, response = request.next_chunk()

    video_id = response["id"]
    return {
        "video_id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "privacy_status": privacy_status,
    }


def _render_frame(
    width: int,
    height: int,
    progress: float,
    title_lines: list[str],
    prompt_lines: list[str],
    title_font: ImageFont.ImageFont,
    body_font: ImageFont.ImageFont,
    small_font: ImageFont.ImageFont,
) -> Image.Image:
    top = np.array([17, 24, 39], dtype=np.float32)
    mid = np.array([19, 113, 99], dtype=np.float32)
    bottom = np.array([244, 162, 97], dtype=np.float32)
    y = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    blend = 0.5 + 0.5 * np.sin((y * 2.8 + progress * 0.9) * np.pi)
    gradient = (top * (1 - y) + bottom * y) * 0.72 + mid * blend * 0.28
    image = Image.fromarray(np.tile(gradient[:, None, :], (1, width, 1)).astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(image, "RGBA")

    pulse = int(34 * np.sin(progress * np.pi))
    draw.rounded_rectangle((54, 84, width - 54, height - 84), radius=44, outline=(255, 255, 255, 74), width=4)
    draw.ellipse((width - 210 + pulse, 150, width + 90 + pulse, 450), fill=(255, 255, 255, 30))
    draw.ellipse((-110 - pulse, height - 420, 210 - pulse, height - 100), fill=(0, 0, 0, 35))

    y_cursor = 220
    for line in title_lines:
        _center_text(draw, line, y_cursor, title_font, width, fill=(255, 255, 255, 245))
        y_cursor += 78

    y_cursor = 535
    for line in prompt_lines:
        _center_text(draw, line, y_cursor, body_font, width, fill=(248, 250, 252, 230))
        y_cursor += 55

    bar_width = int((width - 160) * progress)
    draw.rounded_rectangle((80, height - 172, width - 80, height - 148), radius=12, fill=(255, 255, 255, 58))
    draw.rounded_rectangle((80, height - 172, 80 + bar_width, height - 148), radius=12, fill=(255, 255, 255, 220))
    _center_text(draw, "#Shorts", height - 120, small_font, width, fill=(255, 255, 255, 220))
    return image


def _center_text(draw: ImageDraw.ImageDraw, text: str, y: int, font: ImageFont.ImageFont, width: int, fill: tuple[int, ...]) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (width - (bbox[2] - bbox[0])) // 2
    draw.text((x, y), text, font=font, fill=fill)


def _load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def _wrap_text(text: str, width: int) -> list[str]:
    lines = []
    for part in text.splitlines():
        lines.extend(textwrap.wrap(part.strip(), width=width) or [""])
    return lines[:10]


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug[:60] or "youtube-short"
