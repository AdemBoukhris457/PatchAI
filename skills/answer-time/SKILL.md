---
name: answer-time
description: Report the current UTC time. Use when the user asks what time it is, today's date, or the time right now.
---

# answer-time

## Steps

1. Call `current_time`.
2. Answer with the timestamp the tool returned, and say that it is UTC.
3. If the user asks for another timezone, start from that UTC timestamp and label the conversion. Do not invent a timestamp.

## Done when

The reply contains the tool's timestamp and states that it is UTC.
