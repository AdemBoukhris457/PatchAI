---
name: render-spec
description: Build an interactive report or dashboard beside the chat, with text, tables, charts, and diagrams. Use when the user asks for a report, a dashboard, a comparison, a plan, or an artifact they can scan or use.
---

# render-spec

## Steps

1. Gather the facts first. Call the other tools you need before writing, so every number comes from a source or from the user.
2. Call `render_spec` once. Put the JSONL patch lines in `patches`, or pass one complete `spec` object. Those lines belong in the tool argument. The chat reply stays a sentence or two.
3. If the tool returns `ok: false`, read `feedback` and call `render_spec` again with the same title and only the lines that fix it.
4. After `ok: true`, say what the report shows in two sentences. The panel already draws it, so do not repeat its figures, and do not write a filename.

The catalog below is the component list. Where it says to output only patch lines, that means the `patches` argument.

# Declarative UI

You describe UI as a spec of trusted components that the host renders with its own design system. You choose components and data; the host owns styling.

## Output protocol

A spec is flat: `{ "root": id, "elements": { id: element }, "state": { … } }`. An element is `{ "type", "props", "children": [ids], "slots"?, "visible"?, "repeat"?, "on"?, "watch"? }`. Children are ids, never nested elements.

Build it with JSON Patch (RFC 6902) operations, one JSON object per line (JSONL), so the UI renders while you write:

- Set the root first: `{"op":"add","path":"/root","value":"main"}`.
- Then add each element whole, parents before children, in reading order: `{"op":"add","path":"/elements/main","value":{…}}`. A child id may be listed before its element is added.
- Put initial state under `/state` before elements that read it: `{"op":"add","path":"/state/filter","value":"all"}`.
- Append to an array with `-`: `/elements/main/children/-`. Escape `/` in a key as `~1` and `~` as `~0`.
- To change something, `replace` or `remove` its path; do not repeat unchanged elements.
- Ids are short, unique, kebab-case, and describe the element (`revenue-card`).

Output only patch lines: no prose, no code fences, no comments.

## Components

Use only these types.

### Header
A section heading. Renders as a bold title.
props: { text: string | number; size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" }
  - text: The heading text or number.
  - size: Heading size; defaults to `lg`.
children: `children`

### Text
A run of text. Use for paragraphs, labels, or inline copy.
props: { value: string | number; size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"; weight?: "normal" | "medium" | "semibold" | "bold"; color?: "emphasis" | "secondary" | "alpha-70" | "white" | "white-70" | "white-50" }
  - value: The text or number to display.
  - size: Text size; defaults to `md`.
  - weight: Font weight.
  - color: Foreground color token.
children: `children`

### Caption
Secondary, de-emphasized text under a primary element.
props: { value: string | number }
  - value: The caption text or number.
children: `children`

### Image
An image. Provide `src` and `alt` for accessibility. Put several images in a `Row` for a gallery, or a `sm` image beside text for a thumbnail.
props: { src: string; alt: string; size?: "sm" | "md" | "lg" | number; round?: boolean }
  - src: Image URL, taken from a tool result or the user; never invent one.
  - alt: Alt text for accessibility.
  - size: Size token or pixel value.
  - round: Render as a circular avatar (fully rounded, cropped to a square).
children: none

### Divider
A horizontal rule between sections.
props: { flush?: boolean }
  - flush: Whether the divider spans the full width with no inset.
children: none

### Diagram
A diagram drawn from Mermaid source, such as a flowchart, a sequence of messages, or the states of a process. Keep it small and label the nodes in plain words.
props: { code: string; title?: string | number }
  - code: Mermaid source, such as `flowchart LR` followed by `A[Order] --> B[Ship]`.
  - title: A caption for the diagram, as text or a number.
children: none

### Map
Places on a map, such as the stops of a trip or locations to compare, with an optional route through them in order.
props: { places: { label: string; lat: number; lng: number; detail?: string }[]; route?: boolean }
  - places: The places, in order.
  - route: Draw a line through the places in order.
children: none

### Fact
A label/value pair, rendered as a key followed by its value. Use for compact metadata, and put an answer's key figures side by side in a `Row`.
props: { label: string | number; value: string | number; delta?: string; trend?: "up" | "down" | "flat"; upIsGood?: boolean }
  - label: The fact label (key) as text or a number.
  - value: The fact value as text or a number.
  - delta: Change from before.
  - trend: Change direction.
  - upIsGood: Whether up is good.
children: `children`

### Button
A clickable button. Emits `press` on click. Set `submit` to submit an ancestor Form or Card instead.
props: { label: string | number; buttonStyle?: "primary" | "secondary" | "outline" | "ghost" | "danger"; block?: boolean; submit?: boolean; undoable?: boolean }
  - label: Button label text or number.
  - buttonStyle: Visual style.
  - block: Whether the button spans the full width.
  - submit: Render as a submit button for an ancestor Form/Card instead of a click button.
  - undoable: Delay the action with an undo control, for sends and other hard-to-reverse actions.
children: `children`
events: `press`

### Select
A dropdown selector. Emits `change` with the selected value.
props: { options: { label: string; value: string }[]; placeholder?: string | number; label?: string; name?: string; defaultValue?: string; required?: boolean }
  - options: Selectable options.
  - placeholder: Placeholder text or number shown when nothing is selected.
  - label: Accessible label for the control.
  - name: Field name used inside a Form.
  - defaultValue: Initially selected value.
  - required: Require a selection in a form.
children: `children`
events: `change`

### Input
A text input. Outside a Form it emits `submit` with its text on Enter (Ctrl or Cmd+Enter when `multiline`); inside a Form its value arrives with the Form's `submit`.
props: { inputType?: "text" | "password" | "number"; placeholder?: string; multiline?: boolean; label?: string; name?: string; defaultValue?: string; required?: boolean; minLength?: integer; maxLength?: integer; min?: number; max?: number }
  - inputType: Single-line input type. Values remain strings.
  - placeholder: Placeholder text.
  - multiline: Render a textarea instead of a single-line input; ignored when `inputType` is `"password"` or `"number"`.
  - label: Accessible label for the control.
  - name: Field name used inside a Form.
  - defaultValue: Initial text.
  - required: Require a value in a form.
  - minLength: Minimum text length.
  - maxLength: Maximum text length.
  - min: Minimum numeric value for a number input.
  - max: Maximum numeric value for a number input.
children: none
events: `submit`

### DatePicker
A date, datetime, or time input. Emits `change` once per committed value: a pick from the picker, or a typed value on blur or Enter.
props: { inputType?: "date" | "datetime" | "time"; value?: string; min?: string; max?: string; label?: string; name?: string; required?: boolean }
  - inputType: Temporal input type. Defaults to "date". Values remain strings.
  - value: Initial value: YYYY-MM-DD for date, HH:mm or HH:mm:ss with optional fraction of at most 9 digits for time, YYYY-MM-DDTHH:mm with optional :ss and fraction of at most 9 digits for datetime. A datetime with Z or ±HH:mm is an instant, displayed in the viewer's time zone and submitted with the same offset and precision. A datetime without an offset is local and submitted unchanged. An empty datetime submits with the viewer's offset and seconds.
  - min: Minimum value: YYYY-MM-DD for date, HH:mm or HH:mm:ss with optional fraction of at most 9 digits for time, YYYY-MM-DDTHH:mm with optional :ss and fraction of at most 9 digits for datetime. Datetimes with Z or ±HH:mm are converted to the viewer's time zone.
  - max: Maximum value: YYYY-MM-DD for date, HH:mm or HH:mm:ss with optional fraction of at most 9 digits for time, YYYY-MM-DDTHH:mm with optional :ss and fraction of at most 9 digits for datetime. Datetimes with Z or ±HH:mm are converted to the viewer's time zone.
  - label: Accessible label for the control.
  - name: Field name used inside a Form.
  - required: Require a date or time in a form.
children: none
events: `change`

### Checkbox
A checkbox with a label. Emits `change` with whether it is checked.
props: { label: string | number; name?: string; required?: boolean; defaultChecked?: boolean; variant?: "checkbox" | "switch" }
  - label: Label text or number next to the checkbox.
  - name: Field name used inside a Form.
  - required: Require the checkbox to be checked.
  - defaultChecked: Whether the checkbox starts checked.
  - variant: Whether to render a checkbox or switch.
children: none
events: `change`

### Slider
A numeric range control. Emits `change` with the value once an adjustment finishes.
props: { name?: string; label?: string; min: number; max: number; step?: number; defaultValue?: number; unit?: string }
  - name: Field name used inside a Form.
  - label: Accessible label for the control.
  - min: Minimum value.
  - max: Maximum value.
  - step: Value increment. Defaults to 1.
  - defaultValue: Initial value.
  - unit: Unit shown with the value.
children: none
events: `change`

### RadioGroup
A group of mutually exclusive radio options. Emits `change` with the selected value.
props: { options: { label: string; value: string; description?: string }[]; name?: string; label?: string; defaultValue?: string; required?: boolean }
  - options: Selectable options.
  - name: Field name used inside a Form.
  - label: Accessible name for the group.
  - defaultValue: Initially selected value.
  - required: Require a selected option in a form.
children: `children`
events: `change`

### CheckboxGroup
A group of checkbox options where any number can be checked. Set `progress` for a checklist the user works through. Emits `change` with the checked values.
props: { options: { label: string; value: string; description?: string }[]; name?: string; label?: string; defaultValue?: string[]; progress?: boolean; required?: boolean }
  - options: Selectable options.
  - name: Field name used inside a Form.
  - label: Accessible name for the group.
  - defaultValue: Initially checked values.
  - progress: Show how many options are checked, with a progress bar.
  - required: Require at least one checked option in a form.
children: `children`
events: `change`

### Form
Wraps named child controls (Select, Input, Checkbox, RadioGroup, CheckboxGroup, or DatePicker with a `name`). Emits `submit` with every named control's value, keyed by `name`.
props: { gap?: number }
  - gap: Gap between children in 4px units. 0 to 8 is the supported range.
children: `children`
events: `submit`

### Card
A module the reader scans or acts on, such as a summary, a checklist, a form, or one option in a comparison. It renders as a panel, so keep plain sections (a `Header` with `Text` or `Markdown`) outside cards, and do not wrap the whole answer in one card or nest cards. It takes on a framed surface when `background` is set, when `confirm`/`cancel` add a footer, or when it is a slot in a `Carousel`. Set `asForm` to collect named child control values on submit.
props: { title?: string | number; padding?: number; background?: string; asForm?: boolean; confirm?: { label: string | number }; cancel?: { label: string | number } }
  - title: Optional card title text or number.
  - padding: Padding in 4px units (e.g. 2 = 8px). 0 to 8 is the supported range.
  - background: Background color or gradient. Resource-loading functions and CSS escapes are ignored. Setting this also switches the card's own text to white, since a custom background makes the card a tinted surface; children can still opt into a different color explicitly.
  - asForm: Render as a form; submitting it, through the confirm button or a child Button with `submit`, emits `confirm` with every named child control's value, keyed by `name`.
  - confirm: Confirm button shown in the footer; emits `confirm`.
  - cancel: Cancel button shown in the footer; emits `cancel`.
children: `children`
events: `confirm`, `cancel`

### Col
A vertical stack; children laid out top to bottom.
props: { gap?: number; align?: "start" | "center" | "end" }
  - gap: Gap between children in 4px units. 0 to 8 is the supported range.
  - align: Cross-axis alignment.
children: `children`

### Row
A horizontal row; children laid out left to right.
props: { gap?: number; align?: "start" | "center" | "end"; justify?: "start" | "center" | "end" | "between" }
  - gap: Gap between children in 4px units. 0 to 8 is the supported range.
  - align: Cross-axis alignment.
  - justify: Main-axis distribution.
children: `children`

### Spacer
Empty space that pushes neighbors apart.
props: {}
children: none

### Badge
A small labeled tag, e.g. for status or category.
props: { value: string | number; variant?: string }
  - value: Badge text or number.
  - variant: Visual variant token.
children: `children`

### Box
A generic container for composition, e.g. a progress bar built from an outer track Box containing a partial-width fill Box. Size accepts numbers (pixels) and CSS lengths; background accepts colors and gradients. These render as inline styles rather than data-attribute hooks.
props: { width?: string | number; height?: string | number; radius?: "full" | number; background?: string }
  - width: Width; a number is pixels, a string is a CSS length such as "50%" or "12rem".
  - height: Height; a number is pixels, a string is a CSS length such as "1.5rem".
  - radius: Corner radius; "full" is a pill/circle, a number is pixels.
  - background: Background color or gradient. Resource-loading functions and CSS escapes are ignored.
children: `children`

### Tabs
Panels the user switches between with tabs, one visible at a time. Use it for parallel content the user looks at one part at a time, such as options, plans, or days. Each child is one panel, usually a Col, labeled by the matching entry in `tabs`.
props: { tabs: (string | number)[]; label?: string | number }
  - tabs: Tab labels as text or numbers, one per child panel, in order.
  - label: Accessible name as text or a number for the row of tabs.
children: `children`

### ListView
A vertical list container. Wrap `ListViewItem` children as rows.
props: {}
children: `children`

### ListViewItem
A row inside a ListView. Emits `press` when the row is clicked or activated with Enter or Space.
props: {}
children: `children`
events: `press`

### Steps
Numbered steps to follow in order, such as instructions or a how-to guide. Each step has a short `title` saying what to do and an optional `detail` on how.
props: { steps: ({ title: string | number; detail?: string | number })[] }
  - steps: The steps, in order.
children: none

### Timeline
Events in time order, each with a time or date label, such as a schedule, an itinerary, or a history.
props: { items: ({ time: string | number; title: string | number; detail?: string | number })[] }
  - items: The events, in time order.
children: none

### Table
Tabular data. Provide `columns` and `rows`; each row is an array of cells matching the columns.
props: { columns?: ({ label: string; align?: "start" | "end"; format?: { kind: "number" | "currency" | "percent" | "date"; currency?: string; decimals?: number } })[]; rows?: ((string | number | boolean)[])[]; sortable?: boolean }
  - columns: Column definitions.
  - rows: Rows of cells.
  - sortable: Allow header sorting.
children: `children`

### Markdown
A markdown string. Rendered as-is by default; override this component for a full markdown renderer.
props: { value: string }
  - value: Markdown source.
children: `children`

### Chart
A chart. `variant` selects bar, line, sparkline, or area rendering. Provide `data` for a single series, or `series` for multiple named series (`series` takes precedence over `data` when both are present). Set `stacked` to accumulate series values instead of overlaying them, and `showAxis`/`showLegend` to add y-axis ticks, x-axis point labels, and a legend.
props: { variant: "bar" | "line" | "sparkline" | "area"; data?: { label?: string; value: number }[]; series?: { label?: string; color?: string; data: { label?: string; value: number }[] }[]; stacked?: boolean; showAxis?: boolean; showLegend?: boolean; color?: string }
  - variant: Chart variant.
  - data: Data points for a single series.
  - series: Multiple named series; takes precedence over `data` when present.
  - stacked: Accumulate series values instead of overlaying them (bar and area variants; ignored for line and sparkline).
  - showAxis: Show y-axis ticks and x-axis point labels.
  - showLegend: Show a legend mapping each series to its color.
  - color: Series color (single-series mode only). One of `emphasis`, `secondary`, `alpha-70`, `white`, `white-70`, or `white-50`, matching Text's `color` tokens; other values have no visual effect.
children: none

### Citation
A source the answer draws on, shown as a card with its title and site that links to it. Use one per source.
props: { title: string | number; url?: string; source?: string | number; snippet?: string | number }
  - title: The source's title as text or a number.
  - url: Link to the source; only http and https links open.
  - source: Where it comes from, such as a site or publication, as text or a number. Defaults to the link's domain.
  - snippet: A short quote or summary of what the source says, as text or a number.
children: none

### Alert
A highlighted message conveying urgency. `tone` drives the severity.
props: { title?: string | number; description?: string | number; tone?: "info" | "success" | "warning" | "danger" }
  - title: Alert title text or number.
  - description: Supporting description text or number.
  - tone: Severity tone; defaults to `info`.
children: `children`

### Carousel
A horizontally scrollable group of `Card` children (max 10). Set `label` for an accessible name.
props: { label?: string }
  - label: Accessible label for the carousel.
children: `children`

### Icon
A small line icon from the built-in set. `size` controls the rendered pixel size.
props: { name: "sun" | "moon" | "cloud" | "rain" | "snow" | "wind" | "play" | "pause" | "check" | "x" | "star" | "heart" | "arrow-right" | "arrow-up-right" | "chevron-right" | "calendar" | "clock" | "map-pin" | "plane" | "truck" | "credit-card" | "user" | "search" | "bell"; size?: "sm" | "md" | "lg" }
  - name: Which built-in icon to render.
  - size: Icon size; defaults to `md` (16px).
children: none

## Actions

Bind actions to a component's events with `on`: `"on": { "press": { "action": "setState", "params": { "path": "/tab", "value": "b" } } }`. A list runs in order. Params may use expressions, and `{ "$event": "" }` reads the payload the event carried.

- `setState` — params `{ path: string; value?: unknown }`. Writes `value` at the JSON Pointer `path` in state. Built in. Append with `{ "action": "setState", "params": { "path": "/items/-", "value": … } }`; inside `repeat`, remove with `{ "action": "setState", "params": { "path": "/items", "value": { "$calc": "without(${/items}, ${$index})" } } }`.

## Expressions

Any prop or action param, or any value nested inside one, may be an expression object instead of a literal:

- `{ "$state": "/path" }` reads state.
- `{ "$bindState": "/path" }` reads state and lets the component write it back (inputs, toggles, selects).
- `{ "$template": "Hello ${/user/name}" }` fills `${…}` placeholders with state values; outside `$template` and `$calc`, a placeholder shows as written.
- `{ "$cond": condition, "$then": a, "$else": b }` picks a value.
- `{ "$calc": "round(${/guests} * 0.5, 1) + ' lb'" }` computes a value with a formula over `${…}` references, numbers, and `'text'`: `+ - * / %`, `== != < <= > >=`, `a ? b : c`, and `&& || !`, which give `true` or `false` (write a default as `${/name} ? ${/name} : 'Guest'`). Functions: `round(x, digits)`, `floor`, `ceil`, `abs`, `clamp(x, low, high)`, `min` and `max` (of numbers, or of a list), `count(list)`, `without(list, index)`, `sum(list)` and `avg(list)` (or of a field, `sum(list, '/price')`), and `number(x, digits)`, `currency(x, 'USD')`, and `percent(fraction)` (formatted in the explicitly configured host locale, defaulting to `en-US`), plus `time(minutesAfterMidnight)` and `plural(n, 'item', 'items')`. `+` joins text when either side is text. A formula that cannot compute gives `null`.
- Inside `repeat`: `{ "$item": "/field" }`, `{ "$bindItem": "/field" }`, `{ "$index": true }`, and `${$item/field}` in templates.

## Visibility and repetition

- `"visible"` takes a condition: `true`/`false`, `{ "$state": "/open" }` (truthy), a comparison `{ "$state": "/count", "gt": 0 }` with `eq`, `neq`, `gt`, `gte`, `lt`, or `lte`, a formula `{ "$calc": "${/count} > 2" }`, `{ "not": condition }`, `{ "$or": [ … ] }`, `{ "$and": [ … ] }`, or an array (all must hold).
- `"repeat": { "path": "/items", "key": "id" }` renders the element's children once per item of the state array at `path`.
- `"watch": { "/path": action }` runs an action when a control, action, or handler writes a changed value in the default store from `createStateStore`, not when the spec's own state changes. Custom stores run watches on every value change.

## Rules

- Use only the listed component types, props, events, and actions.
- Every id in `children` or `slots` must be added as an element; every element except the root must be someone's child.
- Give props literal values unless they depend on state; keep data (rows, series) in props or `/state`, not in text.
- Open with a `Header` that names the answer and a `Text` with the one-line takeaway, then give each part of the answer its own section.
- Make each module a `Card`: a summary, a checklist, a form, or one option, with running prose outside cards. Put the answer's key figures side by side in a `Row` of `Fact`s. Show short tags, such as a duration or a price tier, as `Badge`s.
- Put places with coordinates on a `Map`, lay out a schedule or itinerary as a `Timeline`, write instructions as `Steps`, and compare options attribute by attribute in a `Table`.
- Show what can be seen with `Image`, but only from an image URL a tool returned, never one you write yourself: lead with two or three photos in a `Row`, open each option's `Card` with its photo, or put a small photo beside each item's text.
- For a number the user adjusts, such as guests or servings, put it between a `-` and a `+` `Button` in a `Row`, each stepping it with a `setState` whose `$calc` value stays in a sensible range, and compute every amount that depends on it with `$calc`.
- Keep lists in `/state` and render them with `repeat`, except a list a component takes as a prop, such as table rows or chart series, which you bind to that prop.
- Keep the tree shallow and give every element a job: no filler, and no decoration that adds nothing.

## Example

{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/state","value":{"count":0}}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"md"},"children":["title","counter","bump"]}}
{"op":"add","path":"/elements/title","value":{"type":"Heading","props":{"text":"Clicks"}}}
{"op":"add","path":"/elements/counter","value":{"type":"Text","props":{"text":{"$template":"Clicked ${/count} times"}}}}
{"op":"add","path":"/elements/bump","value":{"type":"Button","props":{"label":"Click"},"on":{"press":{"action":"setState","params":{"path":"/count","value":{"$calc":"${/count} + 1"}}}}}}

(The example's types are illustrative; use the components listed above.)