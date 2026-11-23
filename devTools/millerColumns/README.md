# Miller columns prototype

Browse the whole site as one canonical tree: area › topic › article › section › paragraph, or topic › data collection › dimension › view. Every leaf (paragraph, chart, view) is readable in place.

Links never add tree columns. Selecting a block opens a side panel with its links; each link shows its **definition** (the one canonical place of the target) and its **references** (every block that links to or embeds it). Following either is a jump.

History works like VS Code's Go Back (⌫, ⇧⌫ forward): one stop per place you spent time in (a document, or the topic list you browse), and going back lands where you left. The tram line in the top bar shows the stops, dashed where you jumped; click a stop to go there.

## Long lists: 3 per group, then "Show 10 more"

A topic like Cancer holds 14 data insights and 82 charts. Listed in full, the charts would sit far below the insights, and the insights below the articles. So every group in a topic's column shows its first 3, then a row that says what it does:

```
DATA INSIGHTS 14                                 See all ›
  Global deaths from cancer have increased…
  Stomach cancer used to be the main cancer…
  Cancer mortality has declined in many countries
▶ ⌄ Show 10 more ⏎                    ⌘⏎ See all 14
DATA 82                                          See all ›
  …
```

- **"Show 10 more"** is a row like any other (the label stuck above it says of what; screen readers hear "Show 10 more data insights"): ↑ ↓ stop on it, and ⏎, → or a click shows the next 10 right there, on the first of them. The row moves down and counts down ("Show the last 4", then "Show the last one"), then goes away. Nothing grows unless you press it, and ↓ past the row moves on to the next group, so a long group is only in your way if you made it long.
- **"See all ›"** on the group's label lists the whole group as a search of its kind in the topic (`in:cancer is:insight`), where it can be sorted and narrowed with words. From the keyboard, ⌘⏎ on the "Show more" row does it: the row says so while it's selected ("⌘⏎ See all 14", also under the mouse, and clickable; its room is kept even when hidden, so the row never jumps), and so does the key bar. ⌘⇧K offers it too.
- **Leaving the topic** (another topic, or anywhere outside it) folds it back to 3.
- **Landing on an item that's past the first 3** (from search, a link, or history) shows the group down to it, as if you had pressed "Show more", so ↑ and ↓ work from there.

- **Labels stay in view**: a group's label sticks to the top of its column while you scroll through the group, so after "Show more" once or twice you still see you are in Data insights, and how many there are.

Search results use the same groups, the same rows and the same "See all".

## Where you are in a document

A document's column starts with its title, and a section's column with the section's heading; both stick to the top while you scroll. A section's heading also says which document, and which sections above it, it is in ("In How much economic growth is necessary…"), so landing deep in a long article from a reference tells you where you are.

## The box: search, and > for commands

One box at the top finds things and does things. What you type first decides which.

- **Words search** titles and the full text of every article and data page. Results open as a column right after the place being searched, and the highlighted result shows after them in its real place in the tree. They come in the tree's own groups and order (Overview, Articles, Data insights, Data, then Text), and fold like a topic does (see "Long lists" above): 3 each, then "Show 10 more …", and "See all ›" on the label to list only that kind (`is:`). Chips under the count switch between kinds by mouse: one per group, with its count, and All. Changing the search folds every group back to 3. The results stand in for the column of the place searched, so the columns right of them run from just below that place down to the result: you see where it lives before you step in. A result only tagged into the place starts below its own topic. ↑ ↓ move in the results. While you move in them, the left of the screen holds still: only the nearest level, folded into a bar (the breadcrumbs name the rest), whatever the highlighted result shows on the right, so the results never slide as you go down. Once you step into a result, the columns fit as usual. Fitting keeps room on the right for the widest thing that can show there from where you are: a document's preview (640px) in a list, the side panel (760px) inside a document, so ↑ ↓ never fold or open the columns on the left. The results have their own warm ground; the key bar at the bottom says what the keys do, four at most; deep inside a result they fold into a warm strip with the words searched, never out of sight.
- **→ looks inside, ⏎ opens.** → is a column like any other: from the results it lands in the first column right of them, and each further → follows the way down to the match (the columns past the selection keep showing it), so you never skip a column you can see. The search stays: the results fold into a warm strip on the left, and ← climbs back to them as you left them. **⏎ opens what you're on and ends the search**: the match, however deep it sits, or a topic in the tree. ⌫ (Back) brings the search back where you left it. On a "Show more" row, → and ⏎ show more there, and ⌘⏎ sees all of it. A click lands where you click. Once you leave the way to the match (↑ ↓ to another row), the arrows walk the real tree as usual. **← from the results** stands on the place searched, in the column left of them, with the results still showing on its right: ↑ ↓ search the place above or below instead, ← the place it is in, → goes back into the results, ⏎ opens the place. **The way out**: on the results or the place searched, Esc puts you back where you were before searching; inside a result, Esc keeps you where you are and closes the search. In the box, → at the end of the words also steps in. A search is one stop in the history, so Back returns to it, stepped in, opened or not.
- **Keywords** narrow a search and turn into tags once a space ends them: `in:energy` (a topic or area; `in:site` for everything), `is:article` (also `overview`, `insight`, `chart`, `collection`, `explorer`, `text`), `sort:new` or `sort:read`. While you type a keyword, the box suggests its values; ⇥ or ⏎ takes one, and Esc closes the suggestions without ending the search. You don't need the syntax: as you type a word (3 letters or more) that starts a kind, a topic or an order, the menu offers it, matched from the start of the word as you type ("art" → Only articles, In Artificial Intelligence; "new" → Newest first). Nothing is picked until ↓, so ⏎ still opens the highlighted result; ↓ then ⏎, ⇥ or a click turns the word into that tag. With nothing to offer, that spot shows `in:` `is:` `sort:`, which start a keyword when clicked. With no words, `sort:new` or `is:insight` lists everything of that order or kind in the place.
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
- In a topic or area, every content group (articles, data insights, data) shows its first 3, then a "Show 10 more …" row (see "Long lists" above), done in `app.ts`. The order is: items filed there before shortcuts, then the editors' picks in page order, then the most read. The rest stay filed in the topic, not in a column of their own. Subtopics and the overview never fold.
- MDM views nest dimension by dimension, in the config's dimension order.
- Narrative charts sit under their parent chart.
- A chart or view's home is its data page, read like a short document: the chart, its short description, then "What you should know" and "Sources and processing" sections from its indicator's metadata. Narrative charts follow it.
- Document bodies: headings nest, every other block is a leaf. Layout containers (sticky-right, gray sections, …) are flattened.
- A data insight's figure is the chart it names (`narrative-chart`, else `grapher-url`), embedded in place of its static image, so the chart's references list the insight. Insights that name no chart keep their image.
- Every block's text also goes into `text.json` for full-text search; it loads on the first search.
- A chart nobody uses gets up to 3 charts of the same data from other topics (shared x or y indicator, weighted down when many charts share it), shown in its side panel in place of "Not used anywhere".
- Links resolve to one node (chart slugs follow redirects; MDM links with query params resolve to the exact view).
