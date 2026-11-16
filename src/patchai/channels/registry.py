"""Map a configured channel name to its adapter.

Adapters register themselves when their module is imported. The composition
root imports only the active adapter, so unused platforms stay unloaded.
"""

from patchai.channels.protocol import Channel

_CHANNELS: dict[str, Channel] = {}


def register(channel: Channel) -> None:
    """Make ``channel`` available under ``channel.name``."""
    _CHANNELS[channel.name] = channel


def resolve(name: str) -> Channel:
    """Return the adapter registered as ``name``."""
    try:
        return _CHANNELS[name]
    except KeyError as exc:
        known = ", ".join(sorted(_CHANNELS)) or "none"
        raise LookupError(f"Unknown channel '{name}'. Known channels: {known}.") from exc
