---
name: web-search
description: Look up a current public fact on the web. Use when the user asks for news, a public page, or anything that may have changed and no other tool covers it.
---

# web-search

## Steps

1. Leave a stock quote to the market-data tool, a US flood-claim count to `flood_claims`, and the clock to `current_time`. A saved PDF, PowerPoint, Markdown file, or Word document is read with its own source tool.
2. Call `search_web` with a short query. Keep `max_results` at 5 unless the user asked for a wider look.
3. Call `read_web_page` on the one or two results you will cite. A snippet is not the source.
4. Answer from the page. Name the site in the sentence. Do not invent a number or a date the page did not give you.
5. If search or the page returns an error, say so and try one other result. Do not keep searching the same query.

## Done when

The reply states the fact and the site it came from.
