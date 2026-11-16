"""Channel adapters.

Each adapter turns a platform event into a thread message and renders the reply.
"""

from patchai.channels.protocol import Channel
from patchai.channels.registry import register, resolve

__all__ = ["Channel", "register", "resolve"]
