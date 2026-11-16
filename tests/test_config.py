"""The shipped configuration files load into the runtime types."""

from pathlib import Path

import pytest

from patchai.config.loader import load_settings
from patchai.mcp.loader import load_mcp_servers

ROOT = Path(__file__).parents[1]


def test_repository_settings_load() -> None:
    settings = load_settings(ROOT / "config.toml")

    assert settings.channel == "cli"
    assert settings.model == "ollama:llama3.1"
    assert settings.plugins == ("example_clock",)
    assert settings.mcp_config == "mcp.json"


def test_repository_mcp_config_is_an_object() -> None:
    assert load_mcp_servers(ROOT / "mcp.json") == {}


def test_missing_table_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "config.toml"
    path.write_text('[channel]\nactive = "cli"\n', encoding="utf-8")

    with pytest.raises(ValueError, match=r"\[model\]"):
        load_settings(path)


def test_mcp_servers_must_be_an_object(tmp_path: Path) -> None:
    path = tmp_path / "mcp.json"
    path.write_text('{"mcpServers": ["not-an-object"]}\n', encoding="utf-8")

    with pytest.raises(ValueError, match="mcpServers"):
        load_mcp_servers(path)
