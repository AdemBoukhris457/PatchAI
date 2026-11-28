"""Public web search shapes results and refuses a private address."""

import json
import threading

import pytest

from patchai.plugins import web_search
from patchai.plugins.registry import load_enabled


@pytest.fixture(autouse=True)
def _no_waiting(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    waits: list[float] = []
    monkeypatch.setattr(web_search, "_sleep", waits.append)
    web_search._recent_searches.clear()
    web_search._recent_pages.clear()
    return waits


class _Client:
    def __init__(self, timeout: int) -> None:
        self.timeout = timeout

    def text(self, query: str, max_results: int, backend: str = "auto") -> list[dict[str, str]]:
        assert query == "Python release"
        assert max_results == 2
        assert backend == "yahoo"
        return [
            {
                "title": "Python",
                "href": "https://www.python.org/",
                "body": "The official home of the Python Programming Language.",
            },
            {"title": "No address", "href": "", "body": "skip"},
        ]

    def extract(self, url: str, fmt: str = "text_markdown") -> dict[str, str]:
        assert url == "https://www.python.org/"
        assert fmt == "text_plain"
        return {"url": url, "content": "Python is a programming language. " * 2_000}


def test_web_search_exports_search_and_read() -> None:
    loaded = load_enabled(["web_search"])

    assert loaded[0].name == "web_search"
    assert [tool.__name__ for tool in loaded[0].tools()] == ["search_web", "read_web_page"]


def test_search_web_returns_public_results(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_search, "DDGS", _Client)

    reply = json.loads(web_search.search_web("  Python release  ", max_results=2))

    assert reply["query"] == "Python release"
    assert reply["results"] == [
        {
            "title": "Python",
            "url": "https://www.python.org/",
            "snippet": "The official home of the Python Programming Language.",
        }
    ]


@pytest.mark.parametrize(
    ("query", "plain"),
    [
        ("site:go.dev/doc/devel/release Go 1.27", "go.dev Go 1.27"),
        ("Rust 1.100 SITE:https://www.blog.rust-lang.org/2026", "Rust 1.100 blog.rust-lang.org"),
        ("  Python   3.15 release  ", "Python 3.15 release"),
        ("opposite:term stays", "opposite:term stays"),
    ],
)
def test_a_site_filter_becomes_the_site_name(query: str, plain: str) -> None:
    assert web_search._plain_query(query) == plain


def test_search_web_needs_a_query() -> None:
    assert web_search.search_web("   ") == "A search needs a query."


def test_search_web_tries_another_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    class _ThenGoogle:
        def __init__(self, timeout: int) -> None:
            self.timeout = timeout

        def text(self, query: str, max_results: int, backend: str = "auto") -> list[dict[str, str]]:
            if backend == "yahoo":
                raise web_search.DDGSException("No results found.")
            assert backend == "google"
            return [
                {
                    "title": "Python",
                    "href": "https://www.python.org/",
                    "body": "The official home of the Python Programming Language.",
                }
            ]

    monkeypatch.setattr(web_search, "DDGS", _ThenGoogle)

    reply = json.loads(web_search.search_web("Python release"))

    assert reply["results"][0]["url"] == "https://www.python.org/"


def test_search_web_reports_a_refusal(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Refused:
        def __init__(self, timeout: int) -> None:
            self.timeout = timeout

        def text(self, query: str, max_results: int, backend: str = "auto") -> list[dict[str, str]]:
            raise web_search.DDGSException("No results found.")

    monkeypatch.setattr(web_search, "DDGS", _Refused)

    assert "did not answer" in web_search.search_web("Python release")


def test_search_web_waits_and_retries_when_every_engine_rate_limits(
    monkeypatch: pytest.MonkeyPatch, _no_waiting: list[float]
) -> None:
    rounds: list[str] = []

    class _BusyThenFree:
        def __init__(self, timeout: int) -> None:
            self.timeout = timeout

        def text(self, query: str, max_results: int, backend: str = "auto") -> list[dict[str, str]]:
            rounds.append(backend)
            if len(rounds) <= 3:
                raise web_search.RatelimitException("202 Ratelimit")
            return [{"title": "Python", "href": "https://www.python.org/", "body": "Python"}]

    monkeypatch.setattr(web_search, "DDGS", _BusyThenFree)

    reply = json.loads(web_search.search_web("Python release"))

    assert reply["results"][0]["url"] == "https://www.python.org/"
    assert rounds == ["yahoo", "google", "auto", "yahoo"]
    assert web_search._RETRY_WAITS[0] in _no_waiting


def test_search_web_says_so_when_the_engines_stay_rate_limited(
    monkeypatch: pytest.MonkeyPatch, _no_waiting: list[float]
) -> None:
    class _Busy:
        def __init__(self, timeout: int) -> None:
            self.timeout = timeout

        def text(self, query: str, max_results: int, backend: str = "auto") -> list[dict[str, str]]:
            raise web_search.RatelimitException("202 Ratelimit")

    monkeypatch.setattr(web_search, "DDGS", _Busy)

    reply = web_search.search_web("Python release")

    assert reply == "Web search did not answer: 202 Ratelimit"
    assert [wait for wait in _no_waiting if wait in web_search._RETRY_WAITS] == list(
        web_search._RETRY_WAITS
    )


def test_article_keeps_an_opening_that_already_says_something() -> None:
    page = "Python 3.15 is the newest release. " + ("Menu\n" * 20) + "\n\n" + ("Later sentence. " * 30)
    assert web_search._article(page).startswith("Python 3.15 is the newest release.")


def test_article_starts_at_the_first_paragraph() -> None:
    prose = "Python is a programming language. It is used widely. " * 6
    page = "Main menu\n\n" + ("Link\n" * 500) + "\n\n" + prose + "\n\n" + ("x" * 300)
    text = web_search._article(page)
    assert text.startswith("Python is a programming language.")


def _public_lookup(host: str, port: int | None, *_args: object, **_kwargs: object) -> list:
    assert host == "www.python.org"
    return [(2, 1, 6, "", ("1.1.1.1", 0))]


def test_read_web_page_clips_a_long_page(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_search, "DDGS", _Client)
    monkeypatch.setattr(web_search.socket, "getaddrinfo", _public_lookup)

    reply = json.loads(web_search.read_web_page("https://www.python.org/"))

    assert reply["url"] == "https://www.python.org/"
    assert reply["truncated"] is True
    assert len(reply["text"]) == 8_000


def test_a_page_read_again_comes_from_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    reads: list[str] = []

    class _Counting(_Client):
        def extract(self, url: str, fmt: str = "text_markdown") -> dict[str, str]:
            reads.append(url)
            return super().extract(url, fmt)

    monkeypatch.setattr(web_search, "DDGS", _Counting)
    monkeypatch.setattr(web_search.socket, "getaddrinfo", _public_lookup)

    first = web_search.read_web_page("https://www.python.org/")
    again = web_search.read_web_page("https://www.python.org/#downloads")

    assert again == first
    assert reads == ["https://www.python.org/"]


def test_workers_reading_one_page_at_once_share_one_fetch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = threading.Event()
    release = threading.Event()
    reads: list[str] = []

    class _Slow(_Client):
        def extract(self, url: str, fmt: str = "text_markdown") -> dict[str, str]:
            reads.append(url)
            started.set()
            release.wait(5)
            return super().extract(url, fmt)

    monkeypatch.setattr(web_search, "DDGS", _Slow)
    monkeypatch.setattr(web_search.socket, "getaddrinfo", _public_lookup)
    replies: list[str] = []

    def read() -> None:
        replies.append(web_search.read_web_page("https://www.python.org/"))

    first = threading.Thread(target=read)
    first.start()
    assert started.wait(5)
    second = threading.Thread(target=read)
    second.start()
    release.set()
    first.join(5)
    second.join(5)

    assert reads == ["https://www.python.org/"]
    assert len(replies) == 2
    assert replies[0] == replies[1]


def test_a_page_that_failed_is_tried_again(monkeypatch: pytest.MonkeyPatch) -> None:
    tries: list[str] = []

    class _FailsOnce(_Client):
        def extract(self, url: str, fmt: str = "text_markdown") -> dict[str, str]:
            tries.append(url)
            if len(tries) == 1:
                raise web_search.DDGSException("timed out")
            return super().extract(url, fmt)

    monkeypatch.setattr(web_search, "DDGS", _FailsOnce)
    monkeypatch.setattr(web_search.socket, "getaddrinfo", _public_lookup)

    assert "could not be read" in web_search.read_web_page("https://www.python.org/")
    assert json.loads(web_search.read_web_page("https://www.python.org/"))["truncated"] is True
    assert len(tries) == 2


def test_the_same_search_from_another_worker_comes_from_memory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    searches: list[str] = []

    class _Counting(_Client):
        def text(self, query: str, max_results: int, backend: str = "auto") -> list[dict[str, str]]:
            searches.append(query)
            return super().text(query, max_results, backend)

    monkeypatch.setattr(web_search, "DDGS", _Counting)

    first = web_search.search_web("Python release", max_results=2)
    again = web_search.search_web("  python release ", max_results=2)

    assert json.loads(again)["results"] == json.loads(first)["results"]
    assert searches == ["Python release"]


def test_read_web_page_rejects_a_name_that_points_inward(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _inward(host: str, port: int | None, *_args: object, **_kwargs: object) -> list:
        assert host == "example.com"
        return [(2, 1, 6, "", ("127.0.0.1", 0))]

    monkeypatch.setattr(web_search.socket, "getaddrinfo", _inward)

    assert (
        web_search.read_web_page("https://example.com/")
        == "That address is not a public web page."
    )


@pytest.mark.parametrize(
    "url",
    [
        "file:///c/windows/win.ini",
        "http://localhost/secret",
        "http://127.0.0.1/secret",
        "http://169.254.169.254/latest",
        "http://10.0.0.1/",
        "https://user:password@example.com/",
    ],
)
def test_read_web_page_rejects_a_private_address(url: str) -> None:
    reply = web_search.read_web_page(url)
    assert reply in {
        "The address must be an http or https page.",
        "That address is not a public web page.",
    }
