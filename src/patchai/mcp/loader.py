"""Read an MCP server map from a JSON file."""

import json
from pathlib import Path


def load_mcp_servers(path: Path) -> dict[str, object]:
    """Return the ``mcpServers`` object from ``path``."""
    with path.open(encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    servers = raw.get("mcpServers", {})
    if not isinstance(servers, dict):
        raise ValueError(f"{path} field 'mcpServers' must be an object.")
    return servers
