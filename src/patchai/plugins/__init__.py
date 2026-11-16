"""In-process tools.

A plugin module exports a ``plugin`` object. The composition root passes the
enabled ones to the agent.
"""

from patchai.plugins.protocol import Plugin
from patchai.plugins.registry import load_enabled

__all__ = ["Plugin", "load_enabled"]
