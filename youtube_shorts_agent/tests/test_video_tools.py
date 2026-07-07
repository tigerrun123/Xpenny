from youtube_shorts_agent.video_tools import _slugify, _wrap_text


def test_slugify_has_fallback():
    assert _slugify("!!!") == "youtube-short"


def test_wrap_text_limits_lines():
    lines = _wrap_text("one two three four five six", 7)
    assert lines
    assert all(len(line) <= 7 for line in lines)
