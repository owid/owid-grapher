# Miller columns prototype

Browse the whole site as one canonical tree: area › topic › article › section › paragraph, or topic › data collection › dimension › view. Every leaf (paragraph, chart, view) is readable in place.

Links never add tree columns. Selecting a block opens a side panel with its links; each link shows its **definition** (the one canonical place of the target) and its **references** (every block that links to or embeds it). Following either is a jump.

History works like VS Code's Go Back (⌫, ⇧⌫ forward): one stop per place you spent time in (a document, or the topic list you browse), and going back lands where you left. The tram line in the top bar shows the stops, dashed where you jumped; click a stop to go there.

## The box: search, and > for commands

One box at the top finds things and does things. What you type first decides which.

- **Words search** titles and the full text of every article and data page. Results open as a column right after the place being searched, and the highlighted result shows after them in its real place in the tree. They come in the tree's own groups and order (Overview, Articles, Data insights, Data, then Text), and fold like a topic does: 3 each, then a "N more" row that lists all of that kind (`is:`), on the first one you hadn't seen. Chips under the count do the same by mouse: one per group, with its count, and All. The results stand in for the column of the place searched, so the columns right of them run from just below that place down to the result: you see where it lives before you step in. A result only tagged into the place starts below its own topic. ↑ ↓ move in the results. The results have their own warm ground and say what the keys do; deep inside a result they fold into a warm strip with the words searched, never out of sight.
- **→ looks inside, ⏎ opens.** → is a column like any other: from the results it lands in the first column right of them, and each further → follows the way down to the match (the columns past the selection keep showing it), so you never skip a column you can see. The search stays: the results fold into a warm strip on the left, and ← climbs back to them as you left them. **⏎ opens what you're on and ends the search**: the match, however deep it sits, or a topic in the tree. ⌫ (Back) brings the search back where you left it. On a "N more" row, → and ⏎ both list all of it. A click lands where you click. Once you leave the way to the match (↑ ↓ to another row), the arrows walk the real tree as usual. **The way out**: on the results, ← or Esc puts you back where you were before searching; inside a result, Esc keeps you where you are and closes the search. In the box, → at the end of the words also steps in. A search is one stop in the history, so Back returns to it, stepped in, opened or not.
- **Keywords** narrow a search and turn into tags once a space ends them: `in:energy` (a topic or area; `in:site` for everything), `is:article` (also `overview`, `insight`, `chart`, `collection`, `explorer`, `text`), `sort:new` or `sort:read`. While you type a keyword, the box suggests its values; ⇥ or ⏎ takes one. With no words, `sort:new` or `is:insight` lists everything of that order or kind in the place.
- **Topics and areas are places, not results.** When your words are a place's name ("cancer", "nuclear"), it shows first under **Search in**: ⏎ opens it in the tree, → walks into it like any result. Once there, the box searches in it. Longer words ("cancer deaths") go straight to content. A place alone is a search too, and lists what its column does, in the same order: what is filed there before what is only tagged there, then the **editors' picks** (what its Overview links to or embeds, in page order), then the most read.
- **⌘F searches the document you're looking at**, any kind: an article, a data insight, a chart's data page. With no words it lists the document's sections; with words, the matching blocks, in reading order, each named by its section. Backspace at the start widens to the topic. It replaces the browser's find in page; Esc gets you out.
- **The scope starts where you are**: the nearest topic above the selection. Backspace at the start of the box takes the last tag off, and once only the place is left it widens one level each time, up to the whole site. Clicking another place in the tree left of the results searches there instead.
- **`>`** turns the box into commands on the selected row (follow its links, show where it's used, go up, open on the live site, copy a link), back and forward, and recent places. Deleting the `>` brings the search back.
- The tag at the left always says what the box acts on: **in** a place for search, **on** a row for commands.

`/` or ⌘K focuses the box to search; ⌘F searches the open document; ⌘⇧K opens it on commands.

Sorting by popularity uses `analytics_popularity`, which only ranks items of one kind, so `sort:read` (and a search with no words) keeps one section per kind.

## Run

Needs the local MySQL (`make up` or `make up.worktree`).

```bash
yarn tsx --tsconfig tsconfig.tsx.json devTools/millerColumns/buildData.mts
yarn vite --config devTools/millerColumns/vite.config.mts
```

Then open http://localhost:8470. Thumbnails come from the live site. Chart blocks (in articles and on data pages) load the interactive chart from this checkout's admin server (`ADMIN_SERVER_PORT` in `.env`, so the dev stack must be up) as they come within a column-height of view; the thumbnail shows until it loads. Keeping charts alive across re-renders uses `moveBefore()` (Chrome 133+). Clicking into a chart moves the keyboard into it: click outside to get the arrows back.

## How the tree is built (`buildData.mts`)

- Topics: `tag_graph` is a DAG. Each tag keeps its heaviest parent edge as canonical; its other parents get a shortcut row in the Topics group, below the topic's own subtopics, which jumps to where the topic lives.
- Articles, data insights, charts, MDMs, explorers: placed under their most specific tag (deepest in the tree). Their other tags put a shortcut row in their kind's group there, below the items filed there.
- A topic page is the overview of its own topic, listed first, before subtopics.
- In a topic or area, every content group (articles, data insights, data) shows its first 3, then one "N more" row ("23 more charts and collections ›"), done in `app.ts`, so no kind crowds out another. The order is: items filed there before shortcuts, then the editors' picks in page order, then the most read. The "N more" row opens all of the group as a search of that kind in the place (`in:cancer is:insight`), not as a column of its own: the rest stay filed in the topic, so a folded item you land on shows in the topic's column, in its place. Subtopics and the overview never fold.
- MDM views nest dimension by dimension, in the config's dimension order.
- Narrative charts sit under their parent chart.
- A chart or view's home is its data page, read like a short document: the chart, its short description, then "What you should know" and "Sources and processing" sections from its indicator's metadata. Narrative charts follow it.
- Document bodies: headings nest, every other block is a leaf. Layout containers (sticky-right, gray sections, …) are flattened.
- A data insight's figure is the chart it names (`narrative-chart`, else `grapher-url`), embedded in place of its static image, so the chart's references list the insight. Insights that name no chart keep their image.
- Every block's text also goes into `text.json` for full-text search; it loads on the first search.
- A chart nobody uses gets up to 3 charts of the same data from other topics (shared x or y indicator, weighted down when many charts share it), shown in its side panel in place of "Not used anywhere".
- Links resolve to one node (chart slugs follow redirects; MDM links with query params resolve to the exact view).
