"""Read an MCP server map from a JSON file and load the tools it names."""

import json
import logging
import warnings
from pathlib import Path

from langchain_core.tools import BaseTool

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from langchain.mcp import MCPAdapter

logger = logging.getLogger(__name__)


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


async def load_mcp_tools(path: Path) -> list[BaseTool]:
    """Connect to each server in ``path`` and return the tools it offers.

    A server that cannot be reached is skipped with a warning, so the other
    servers and the plugins still load.
    """
    tools: list[BaseTool] = []
    for name, server in load_mcp_servers(path).items():
        try:
            async with MCPAdapter({"mcpServers": {name: server}}) as adapter:
                tools.extend(await adapter.list_tools())
        except Exception as exc:  # noqa: BLE001
            logger.warning("MCP server '%s' skipped: %s", name, exc)
    return tools
