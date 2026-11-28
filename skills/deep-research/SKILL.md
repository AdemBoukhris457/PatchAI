---
name: deep-research
description: Research a question across many public web pages with parallel research workers, then write one cited report. Use when research mode is on, or when the user asks for research, a deep dive, a comparison across sources, or a report from the web.
---

# deep-research

You lead the research. The research workers search and read the web. You plan, start them with `research_round`, check what they bring back, and write the report.

## Steps

1. Classify the question before any search.
   - **Straightforward:** one fact or one narrow topic. Send 1 worker.
   - **Depth-first:** one topic seen from several angles, such as the evidence for and against a policy. Send 2 or 3 workers, one angle each.
   - **Breadth-first:** several separate items, such as three products or three countries. Send one worker per item, up to the workers per round the research brief allows.
   - At deep and max depth, split finer and fill the first round: give an item's separate angles, such as its numbers, its timeline, and its causes, their own workers until every worker the brief allows has a part.
2. In one reply, call `write_todos` with the plan and call `research_round` with one assignment per worker. The round starts every worker at once and returns all their findings together. Name each worker's part in one short plan line, and keep the plan to worker parts only; the report comes after them. Mark every part of the round `in_progress` together. Each assignment says:
   - the objective, in one sentence
   - the time range, using today's date
   - what is out of scope, and what another worker already covers
   - that the worker reads every page it reports
3. Read the findings. Then, in one reply, mark the plan items done with `write_todos` and call `research_round` for the next round. A later round covers what is still missing: parts with too few sources, figures that conflict, newer sources, and leads a worker raised. Run at least the rounds the research brief asks for, and stop at its maximum or earlier once the minimum is met and nothing is missing.
4. Use the time between rounds only to read findings and plan. The workers do all the searching and reading.
5. Write the report in the chat:
   - Open with a short paragraph that answers the question directly.
   - Then use `##` sections, one per part of the plan. Use a table when you compare items.
   - End with `## What is uncertain`: the conflicts, the gaps, and anything older than the user may expect.
6. Cite every factual claim with a numbered link right after the claim: the number is the link text and the page URL is the target, for example `Rust 1.95 shipped on 30 October [1](https://blog.rust-lang.org/2026/10/30/Rust-1.95.0/).` Write the URL in the parentheses every time, also in a table cell. Do not use words such as "release notes" as link text.
   - Number each URL by its first use: 1, 2, 3, with no gaps. Reuse the same number for the same URL.
   - Cite only a URL a worker read with `read_web_page`. A search hit is not a source.
   - Do not add a bibliography or a list of links. The chat lists the sources under the report.
7. After the report, offer one line: the user can ask for it as a PDF, and you will build it with `create_pdf` using the same citations.

## Done when

The report answers the question, every claim has a citation to a page a worker read, and the uncertain points are named.
