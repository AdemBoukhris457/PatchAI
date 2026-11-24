"""render_spec checks a report against the assistant-ui catalog."""

import json

import pytest

from patchai.plugins.registry import load_enabled
from patchai.plugins.report import render_spec, reset_reports

_WEEKLY = {
    "root": "main",
    "elements": {
        "main": {"type": "Col", "props": {"gap": 4}, "children": ["title"]},
        "title": {"type": "Header", "props": {"text": "Weekly signups", "size": "xl"}},
    },
    "state": {},
}


@pytest.fixture(autouse=True)
def _clean_reports() -> None:
    reset_reports()


def test_render_spec_accepts_a_catalog_spec() -> None:
    saved = json.loads(render_spec("weekly_signups", spec=_WEEKLY))

    assert saved["ok"] is True
    assert saved["title"] == "weekly_signups"
    assert saved["spec"]["elements"]["title"]["props"]["text"] == "Weekly signups"
    assert saved["feedback"] == "The spec is valid."


def test_render_spec_rejects_an_unknown_component() -> None:
    saved = json.loads(
        render_spec(
            "weekly_signups",
            spec={"root": "main", "elements": {"main": {"type": "Nope"}}, "state": {}},
        )
    )

    assert saved["ok"] is False
    assert "Nope" in saved["feedback"] or saved["issues"]


def test_render_spec_patches_the_same_title() -> None:
    render_spec("weekly_signups", spec=_WEEKLY)
    saved = json.loads(
        render_spec(
            "weekly_signups",
            patches=json.dumps(
                {
                    "op": "replace",
                    "path": "/elements/title/props/text",
                    "value": "Signups this week",
                }
            ),
        )
    )

    assert saved["ok"] is True
    assert saved["version"] == 2
    assert saved["spec"]["elements"]["title"]["props"]["text"] == "Signups this week"


def test_render_spec_rejects_a_title_with_spaces() -> None:
    saved = json.loads(render_spec("Weekly Signups", spec=_WEEKLY))

    assert saved["ok"] is False
    assert "snake_case" in saved["feedback"]


def test_report_is_a_plugin() -> None:
    (loaded,) = load_enabled(["report"])

    assert loaded.name == "report"
    assert loaded.tools() == [render_spec]
