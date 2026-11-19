"""US flood insurance claims from FEMA's public OpenFEMA API.

Reads the NFIP Redacted Claims dataset (version 3). No key or account is
needed. FEMA allows about 200 requests every five minutes per address.
"""

import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable

_ENDPOINT = "https://www.fema.gov/api/open/v3/NfipClaims"
_FIELDS = (
    "dateOfLoss",
    "nfipCommunityName",
    "floodEvent",
    "ratedFloodZone",
    "netBuildingPaymentAmount",
    "netContentsPaymentAmount",
    "netIccPaymentAmount",
)


def _fetch(params: dict[str, str]) -> dict[str, object]:
    """Return the decoded JSON body for one OpenFEMA query."""
    request = urllib.request.Request(
        f"{_ENDPOINT}?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": "PatchAI"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def flood_claims(state: str, year: int, limit: int = 5) -> str:
    """Count US flood insurance (NFIP) claims for a state and year of loss.

    Use this when the user asks about flood insurance claims, flood losses,
    or NFIP payouts in a US state. ``state`` is the two-letter code such as
    "FL". The reply has the total claim count and the most recent claims
    (up to ``limit``, at most 10) with the community, flood event, flood
    zone, and the amount paid. Recent claims often show 0 paid because
    they are still open. Data comes from FEMA OpenFEMA and is not an
    official federal report.
    """
    code = state.strip().upper()
    if len(code) != 2 or not code.isalpha():
        return "State must be a two-letter US code such as FL."
    params = {
        "$filter": f"state eq '{code}' and yearOfLoss eq {int(year)}",
        "$select": ",".join(_FIELDS),
        "$orderby": "dateOfLoss desc",
        "$top": str(max(1, min(int(limit), 10))),
        "$count": "true",
    }
    try:
        body = _fetch(params)
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        return f"OpenFEMA did not answer: {exc}"
    claims = [
        {
            "date_of_loss": str(row.get("dateOfLoss", ""))[:10],
            "community": row.get("nfipCommunityName"),
            "flood_event": row.get("floodEvent"),
            "flood_zone": row.get("ratedFloodZone"),
            "amount_paid": sum(float(row.get(field) or 0) for field in _FIELDS[4:]),
        }
        for row in body.get("NfipClaims", [])
    ]
    metadata = body.get("metadata") or {}
    return json.dumps(
        {
            "state": code,
            "year_of_loss": int(year),
            "total_claims": metadata.get("count"),
            "recent_claims": claims,
            "source": _ENDPOINT,
        }
    )


class OpenFemaFloodPlugin:
    """Flood insurance claims, registered under the name listed in config.toml."""

    name = "openfema_flood"

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        return [flood_claims]


plugin = OpenFemaFloodPlugin()
