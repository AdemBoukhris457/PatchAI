"""Enabled plugin names resolve to the objects those modules export."""

import json
from datetime import datetime

import pytest

from patchai.plugins import openfema_flood
from patchai.plugins.registry import load_enabled


def test_example_clock_exports_a_utc_clock() -> None:
    loaded = load_enabled(["example_clock"])

    assert len(loaded) == 1
    assert loaded[0].name == "example_clock"
    reported = loaded[0].tools()[0]()
    assert isinstance(reported, str)
    parsed = datetime.fromisoformat(reported)
    assert parsed.tzinfo is not None


def test_openfema_flood_summarizes_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: dict[str, str] = {}

    def fake_fetch(params: dict[str, str]) -> dict[str, object]:
        sent.update(params)
        return {
            "metadata": {"count": 80462},
            "NfipClaims": [
                {
                    "dateOfLoss": "2024-10-09T00:00:00.000Z",
                    "nfipCommunityName": "PINELLAS COUNTY *",
                    "floodEvent": "Hurricane Milton",
                    "ratedFloodZone": "AE",
                    "netBuildingPaymentAmount": 1000.5,
                    "netContentsPaymentAmount": 200,
                    "netIccPaymentAmount": None,
                }
            ],
        }

    monkeypatch.setattr(openfema_flood, "_fetch", fake_fetch)
    (flood_claims,) = load_enabled(["openfema_flood"])[0].tools()

    reply = json.loads(flood_claims("fl", 2024, limit=50))

    assert sent["$filter"] == "state eq 'FL' and yearOfLoss eq 2024"
    assert sent["$top"] == "10"
    assert reply["total_claims"] == 80462
    assert reply["recent_claims"][0]["amount_paid"] == 1200.5
    assert reply["recent_claims"][0]["date_of_loss"] == "2024-10-09"


def test_openfema_flood_rejects_a_bad_state() -> None:
    assert "two-letter" in openfema_flood.flood_claims("Florida", 2024)


def test_unknown_plugin_is_rejected() -> None:
    with pytest.raises(LookupError, match="not installed"):
        load_enabled(["does_not_exist"])


def test_plugin_without_a_plugin_object_is_rejected() -> None:
    with pytest.raises(LookupError, match="must export"):
        load_enabled(["registry"])
