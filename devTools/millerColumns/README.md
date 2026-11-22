# Miller columns prototype

Browse the whole site as one canonical tree: area › topic › article › section › paragraph, or topic › data collection › dimension › view. Every leaf (paragraph, chart, view) is readable in place.

Links never add tree columns. Selecting a block opens a side panel with its links; each link shows its **definition** (the one canonical place of the target) and its **references** (every block that links to or embeds it). Following either is a jump, with ⌫ to return.

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
- Links resolve to one node (chart slugs follow redirects; MDM links with query params resolve to the exact view).
