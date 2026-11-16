"""Enabled plugin names resolve to the objects those modules export."""

from datetime import datetime

import pytest

from patchai.plugins.registry import load_enabled


def test_example_clock_exports_a_utc_clock() -> None:
    loaded = load_enabled(["example_clock"])

    assert len(loaded) == 1
    assert loaded[0].name == "example_clock"
    reported = loaded[0].tools()[0]()
    assert isinstance(reported, str)
    parsed = datetime.fromisoformat(reported)
    assert parsed.tzinfo is not None


def test_unknown_plugin_is_rejected() -> None:
    with pytest.raises(LookupError, match="not installed"):
        load_enabled(["does_not_exist"])


def test_plugin_without_a_plugin_object_is_rejected() -> None:
    with pytest.raises(LookupError, match="must export"):
        load_enabled(["registry"])
