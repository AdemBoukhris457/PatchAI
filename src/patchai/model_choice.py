"""Let one turn use a chat model and reasoning effort the page picked.

The agent is built with the model from configuration. A turn can name one
of the chat models instead, and the model call for that turn uses it.
An effort is written into that call's reasoning settings. The levels here
are the ones every chat model accepts.
"""

from contextvars import ContextVar

from langchain.agents.middleware import AgentMiddleware
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from patchai.config.models import Settings

CHAT_MODELS = frozenset(
    {
        "gpt-6.2-astra",
        "gpt-6.2-sol",
        "gpt-6.1-terra",
        "gpt-6.1-sol",
        "gpt-6-astra",
        "gpt-6-sol",
        "gpt-6-luna",
    }
)

CHAT_EFFORTS = frozenset({"low", "medium", "high", "xhigh", "max"})

requested_model: ContextVar[str | None] = ContextVar("requested_model", default=None)
requested_effort: ContextVar[str | None] = ContextVar("requested_effort", default=None)


class RequestedModel(AgentMiddleware):
    """Swap the model call when this turn named a chat model or an effort."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._cache: dict[tuple[str, str | None], BaseChatModel] = {}

    def wrap_model_call(self, request, handler):
        return handler(self._request(request))

    async def awrap_model_call(self, request, handler):
        return await handler(self._request(request))

    def _request(self, request):
        model_id = requested_model.get()
        if model_id not in CHAT_MODELS:
            model_id = None
        effort = requested_effort.get()
        if effort not in CHAT_EFFORTS:
            effort = None
        if model_id is None and effort is None:
            return request
        if model_id is None:
            model_id = self._builtin_chat_model()
        if model_id is None:
            return request
        return request.override(model=self._model(model_id, effort))

    def _builtin_chat_model(self) -> str | None:
        provider, _, model_id = self._settings.model.partition(":")
        if provider == "openai" and model_id in CHAT_MODELS:
            return model_id
        return None

    def _model(self, model_id: str, effort: str | None) -> BaseChatModel:
        key = (model_id, effort)
        cached = self._cache.get(key)
        if cached is None:
            options = dict(self._settings.model_options.get("openai", {}))
            if effort is not None:
                reasoning = options.get("reasoning")
                merged = dict(reasoning) if isinstance(reasoning, dict) else {}
                merged["effort"] = effort
                options["reasoning"] = merged
            cached = init_chat_model(f"openai:{model_id}", **options)
            self._cache[key] = cached
        return cached
