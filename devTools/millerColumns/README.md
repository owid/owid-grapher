# Miller columns prototype

Browse the whole site as one canonical tree: area › topic › article › section › paragraph, or topic › data collection › dimension › view. Every leaf (paragraph, chart, view) is readable in place.

Links never add tree columns. Selecting a block opens a side panel with its links; each link shows its **definition** (the one canonical place of the target) and its **references** (every block that links to or embeds it). Following either is a jump.

History works like VS Code's Go Back (⌫, ⇧⌫ forward): one stop per place you spent time in (a document, or the topic list you browse), and going back lands where you left. The tram line in the top bar shows the stops, dashed where you jumped; click a stop to go there.

## The box: search, and > for commands

One box at the top finds things and does things. What you type first decides which.

- **Words search** titles and the full text of every article and data page. Results open as a column right after the place being searched, and the highlighted result shows after them in its real place in the tree. The results stand in for the column of the place searched, so the columns right of them run from just below that place down to the result: you see where it lives before you step in. A result only tagged into the place starts below its own topic. ↑ ↓ move in the results. The results have their own warm ground and say what the keys do; deep inside a result they fold into a warm strip with the words searched, never out of sight.
- **The results are a column like any other: → moves one column right.** From the results it lands in the first column right of them, and each further → follows the way down to the match (the columns past the selection keep showing it), so you never skip a column you can see. **⏎ goes straight to the match** instead, however deep it sits (from the results or from the box). The results stay on the left, a warm strip once folded. A click lands where you click. Once you leave the way to the match (↑ ↓ to another row), the arrows walk the real tree as usual, and ← climbs it, then comes back to the results as you left them. Esc decides how the search ends: on the results it puts you back where you were before searching; inside a result it keeps you where you are and closes the search. In the box, → at the end of the words also steps in. A search is one stop in the history, so Back returns to it, stepped in or not.
- **Keywords** narrow a search and turn into tags once a space ends them: `in:energy` (a topic or area; `in:site` for everything), `is:article` (also `page`, `insight`, `chart`, `collection`, `explorer`, `topic`, `text`), `sort:new` or `sort:read`. While you type a keyword, the box suggests its values; ⇥ or ⏎ takes one. With no words, `sort:new` or `is:insight` lists everything of that order or kind in the place.
- **The scope starts where you are**: the nearest topic above the selection. Backspace at the start of the box takes the last tag off, and once only the place is left it widens one level each time, up to the whole site. Clicking another place in the tree left of the results searches there instead.
- **`>`** turns the box into commands on the selected row (follow its links, show where it's used, go up, open on the live site, copy a link), sections of the open document, back and forward, and recent places. Deleting the `>` brings the search back.
- The tag at the left always says what the box acts on: **in** a place for search, **on** a row for commands.

`/` or ⌘K focuses the box to search; ⌘⇧K opens it on commands.

Sorting by popularity uses `analytics_popularity`, which only ranks items of one kind, so `sort:read` (and a search with no words) keeps one section per kind.

## Run

Needs the local MySQL (`make up` or `make up.worktree`).

```bash
yarn tsx --tsconfig tsconfig.tsx.json devTools/millerColumns/buildData.mts
yarn vite --config devTools/millerColumns/vite.config.mts
```

Then open http://localhost:8470. Thumbnails come from the live site. Chart blocks (in articles and on data pages) load the interactive chart from this checkout's admin server (`ADMIN_SERVER_PORT` in `.env`, so the dev stack must be up) as they come within a column-height of view; the thumbnail shows until it loads. Keeping charts alive across re-renders uses `moveBefore()` (Chrome 133+). Clicking into a chart moves the keyboard into it: click outside to get the arrows back.

## How the tree is built (`buildData.mts`)

- Topics: `tag_graph` is a DAG. Each tag keeps its heaviest parent edge as canonical; its other parents get an alias row under "From other topics", which jumps to where the item lives.
- Articles, data insights, charts, MDMs, explorers: placed under their most specific tag (deepest in the tree). Their other tags become alias rows.
- A topic page is the overview of its own topic, listed first, before subtopics.
- In a topic, any content group (articles, data insights, data, from other topics) with more than 5 items folds into one row ("26 articles ›"), done in `app.ts`. Subtopics and the overview never fold.
- MDM views nest dimension by dimension, in the config's dimension order.
- Narrative charts sit under their parent chart.
- A chart or view's home is its data page, read like a short document: the chart, its short description, then "What you should know" and "Sources and processing" sections from its indicator's metadata. Narrative charts follow it.
- Document bodies: headings nest, every other block is a leaf. Layout containers (sticky-right, gray sections, …) are flattened.
- A data insight's figure is the chart it names (`narrative-chart`, else `grapher-url`), embedded in place of its static image, so the chart's references list the insight. Insights that name no chart keep their image.
- Every block's text also goes into `text.json` for full-text search; it loads on the first search.
- A chart nobody uses gets up to 3 charts of the same data from other topics (shared x or y indicator, weighted down when many charts share it), shown in its side panel in place of "Not used anywhere".
- Links resolve to one node (chart slugs follow redirects; MDM links with query params resolve to the exact view).
