"""Interactive reports the chat draws from a spec.

The spec names components from the assistant-ui vocabulary. A Node script
validates it with that same catalog and returns the issues for a repair.
"""

import json
import re
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Annotated, Any

from pydantic import Field

_TITLE = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
_SCRIPT = Path(__file__).resolve().parents[3] / "web" / "scripts" / "render-spec.mjs"
_SAVED: dict[str, dict[str, Any]] = {}


def render_spec(
    title: Annotated[
        str,
        Field(description="A short snake_case id for this report. Reuse it to revise the same report."),
    ],
    patches: Annotated[
        str | None,
        Field(
            description=(
                "JSONL patch lines that build or revise the report. "
                "One JSON patch object per line. Omit when passing spec."
            )
        ),
    ] = None,
    spec: Annotated[
        dict[str, Any] | None,
        Field(description="A complete spec that replaces the report. Omit when passing patches."),
    ] = None,
) -> str:
    """Show an interactive report beside the chat.

    Use this for a dashboard, a comparison, a plan, or any answer the reader
    scans or acts on. Read the render-spec skill first, then pass the spec
    here. The patches belong in this argument, not in the chat reply. A later
    call with the same title changes that report. If the result says ok is
    false, fix what feedback names and call this again. The reply after a
    successful call is one or two sentences and does not repeat the report.
    """
    name = title.strip()
    if not _TITLE.fullmatch(name):
        return _failure(name or title, "The title must be snake_case, such as weekly_signups.")
    if spec is None and not (patches and patches.strip()):
        return _failure(name, "Pass patches or a complete spec.")
    previous = _SAVED.get(name)
    payload: dict[str, Any] = {
        "title": name,
        "previous": previous["spec"] if previous else None,
        "version": previous["version"] if previous else 0,
    }
    if spec is not None:
        payload["spec"] = spec
    if patches and patches.strip():
        payload["patches"] = patches
    try:
        result = _validate(payload)
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError, ValueError) as exc:
        return _failure(name, f"The report could not be checked: {exc}")
    stored = result.get("spec")
    if isinstance(stored, dict):
        _SAVED[name] = {"spec": stored, "version": result.get("version", 0)}
    return json.dumps(result, ensure_ascii=False)


def reset_reports() -> None:
    """Forget saved reports. Tests use this so one case cannot patch another."""
    _SAVED.clear()


class ReportPlugin:
    """The report tool, registered under the name listed in config.toml."""

    name = "report"

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        return [render_spec]


plugin = ReportPlugin()


def _validate(payload: dict[str, Any]) -> dict[str, Any]:
    if not _SCRIPT.is_file():
        raise FileNotFoundError(_SCRIPT)
    completed = subprocess.run(
        ["node", str(_SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=_SCRIPT.parent.parent,
        timeout=30,
        check=False,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "the checker failed"
        raise ValueError(detail)
    parsed = json.loads(completed.stdout)
    if not isinstance(parsed, dict):
        raise ValueError("the checker returned an unexpected result")
    return parsed


def _failure(title: str, feedback: str) -> str:
    return json.dumps(
        {
            "ok": False,
            "title": title,
            "version": 0,
            "elementCount": 0,
            "issues": [{"code": "invalid", "message": feedback}],
            "feedback": feedback,
            "spec": None,
        }
    )
