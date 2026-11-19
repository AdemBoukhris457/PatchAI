"""Load secrets from a local env file.

Values already set in the process stay as they are. The file never
overrides a variable the operator exported themselves.
"""

import os
from pathlib import Path


def load_env(path: Path) -> None:
    """Set missing environment variables from a ``KEY=value`` file."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        key, value = _pair(line)
        if key is None or key in os.environ:
            continue
        os.environ[key] = value


def _pair(line: str) -> tuple[str, str] | tuple[None, None]:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        return None, None
    if stripped.startswith("export "):
        stripped = stripped.removeprefix("export ").strip()
    key, value = stripped.split("=", 1)
    key = key.strip()
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    if not key:
        return None, None
    return key, value
