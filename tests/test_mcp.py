"""Servers listed in mcp.json become agent tools."""

import asyncio
import json
import sys
from pathlib import Path

from patchai.mcp.loader import load_mcp_tools

_SERVER = '''
from fastmcp import FastMCP

server = FastMCP("quotes")


@server.tool
def premium(age: int) -> str:
    """Return a sample yearly premium for a driver of ``age``."""
    return f"{1000 - age * 5} EUR"


server.run(show_banner=False)
'''


def _write_config(tmp_path: Path, servers: dict[str, object]) -> Path:
    config = tmp_path / "mcp.json"
    config.write_text(json.dumps({"mcpServers": servers}), encoding="utf-8")
    return config


def test_stdio_server_tools_are_loaded_and_callable(tmp_path: Path) -> None:
    script = tmp_path / "quotes.py"
    script.write_text(_SERVER, encoding="utf-8")
    config = _write_config(
        tmp_path, {"quotes": {"command": sys.executable, "args": [str(script)]}}
    )

    tools = asyncio.run(load_mcp_tools(config))

    assert [tool.name for tool in tools] == ["premium"]
    reply = asyncio.run(tools[0].ainvoke({"age": 30}))
    assert "850 EUR" in str(reply)


def test_unreachable_server_is_skipped(tmp_path: Path) -> None:
    config = _write_config(tmp_path, {"offline": {"url": "http://127.0.0.1:9/mcp"}})

    assert asyncio.run(load_mcp_tools(config)) == []


def test_empty_server_map_loads_no_tools(tmp_path: Path) -> None:
    config = _write_config(tmp_path, {})

    assert asyncio.run(load_mcp_tools(config)) == []
