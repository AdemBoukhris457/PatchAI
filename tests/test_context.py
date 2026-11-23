"""Input context follows the Deep Agents layers.

The role prompt and project memory are present on every turn. A skill
contributes its name and description only. Its procedure stays on disk
until the agent reads it. Preferences live in the store, not in the
project files.
"""

from pathlib import Path

from deepagents.backends.protocol import FileDownloadResponse
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langgraph.store.memory import InMemoryStore

from patchai.config.models import Settings
from patchai.harness import SYSTEM_PROMPT, build_agent, memory_namespace, project_backend

ROOT = Path(__file__).parents[1]


def _message_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text", "")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return ""


def _settings() -> Settings:
    return Settings(
        channel="cli",
        model="ollama:llama3.1",
        plugins=("example_clock",),
        mcp_config="mcp.json",
    )


def test_project_memory_and_skills_are_on_disk_and_preferences_are_stored() -> None:
    store = InMemoryStore()
    backend = project_backend(ROOT, store)

    downloaded = backend.download_files(["/memory/AGENTS.md"])
    assert len(downloaded) == 1
    memory = downloaded[0]
    assert isinstance(memory, FileDownloadResponse)
    assert memory.error is None
    assert memory.content is not None
    assert b"Answer in plain text." in memory.content

    listed = backend.ls("/skills/")
    names = [entry["path"] for entry in listed.entries or []]
    assert any(path.rstrip("/").endswith("answer-time") for path in names)

    written = backend.write("/memories/preferences.md", "Keep answers short.")
    assert written.error is None
    stored = store.get(("local",), "/preferences.md")
    assert stored is not None
    assert stored.value["content"] == "Keep answers short."


def test_memory_namespace_uses_the_server_user_or_the_local_user() -> None:
    class _User:
        identity = "ada"

    class _Server:
        user = _User()

    class _Runtime:
        server_info = _Server()

    class _Missing:
        def __getattr__(self, name: str) -> object:
            raise AttributeError(name)

    assert memory_namespace(_Runtime()) == ("ada",)
    assert memory_namespace(_Missing()) == ("local",)


def test_system_prompt_loads_memory_and_skill_metadata_only() -> None:
    seen: list[str] = []
    descriptions: list[str] = []

    class _RecordingModel(GenericFakeChatModel):
        """Fake model that records the system prompt and tool descriptions."""

        def bind_tools(self, tools, *, tool_choice=None, **kwargs):  # noqa: ANN001, ANN003
            descriptions.extend(getattr(tool, "description", "") for tool in tools)
            return self

        def _generate(self, messages, stop=None, run_manager=None, **kwargs):  # noqa: ANN001, ANN003
            for message in messages:
                if getattr(message, "type", "") != "system":
                    continue
                seen.append(_message_text(getattr(message, "content", "")))
            return super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

    agent = build_agent(
        _settings(),
        model=_RecordingModel(messages=iter([AIMessage(content="ack")])),
        root=ROOT,
    )
    agent.invoke(
        {"messages": [{"role": "user", "content": "hello"}]},
        config={"configurable": {"thread_id": "context"}},
    )

    assert seen
    prompt = seen[0]
    assert SYSTEM_PROMPT in prompt
    assert "/memories/preferences.md" in prompt
    assert "read_pdf_source" in prompt
    assert "read_pptx_source" in prompt
    assert "Answer in plain text." in prompt
    assert "answer-time" in prompt
    assert "Report the current UTC time." in prompt
    assert "Do not invent a timestamp." not in prompt
    clock = next(text for text in descriptions if "UTC" in text)
    assert "Use this when" in clock
