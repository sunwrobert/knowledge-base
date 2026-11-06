#!/usr/bin/env python3
"""Run: python3 build_test.py"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import build, render_diff, render_wire, wire_diff  # noqa: E402


def numbers(table: str) -> list[tuple[str, str, str]]:
    return re.findall(r'<tr class="(\w+)"><td class="n">(\d*)</td><td class="n">(\d*)</td>', table)


def test_no_newline_marker_does_not_advance_counters() -> None:
    out = render_diff("@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+c\n\\ No newline at end of file\n")
    assert numbers(out) == [
        ("ctx", "1", "1"),
        ("del", "2", ""),
        ("meta", "", ""),
        ("add", "", "2"),
        ("meta", "", ""),
    ], numbers(out)
    assert "\\ No newline at end of file" in out


def test_wire_diff_is_full_context_unified_body() -> None:
    out = wire_diff('{\n  "a": 1\n}', '{\n  "a": 1,\n  "b": 2\n}')
    assert out.startswith("@@ -1,3 +1,4 @@\n"), out
    assert numbers(render_diff(out)) == [
        ("ctx", "1", "1"),
        ("del", "2", ""),
        ("add", "", "2"),
        ("add", "", "3"),
        ("ctx", "3", "4"),
    ]


def test_identical_wire_pair_renders_nothing() -> None:
    assert render_wire([{"label": "x", "before": "{}", "after": "{}"}]) == ""


def test_spec_fields_are_escaped() -> None:
    spec = {
        "title": "<b>x</b>",
        "subtitle": "<img src=x>",
        "repo": {"name": "r<i>", "url": "javascript:alert(1)\" onclick=\"x"},
        "fixes": [
            {
                "id": "a\"b",
                "title": "<script>",
                "pr": {"number": 1, "url": "u\"v"},
                "tags": "<t>",
                "file": "<f>",
                "description": "kept <code>as-is</code>",
                "diff": "@@ -1 +1 @@\n-<x>\n+<y>\n",
                "wire": [{"label": "<w>", "before": "<wb>", "after": "<wa>"}],
            }
        ],
    }
    out = build(spec)
    for raw in ("<b>x</b>", "<img src=x>", "r<i>", "<script>", "<t>", "<f>", "-<x>", "+<y>", 'id="a"b"', 'href="u"v"', "<w>", "<wb>", "<wa>"):
        assert raw not in out, raw
    assert "kept <code>as-is</code>" in out


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
