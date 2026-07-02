# Rich Editing — Technical Plan

_Status: proposal, 2026-07-02. Companion document to `rich-editing-plan.html` (project slideshow)._

This document describes how we build a native, rich in-browser editing experience for OWID content, replacing ArchieML-in-Google-Docs authoring with a block-based WYSIWYG editor in the admin. It reflects four direction decisions already made:

1. **Source of truth**: native-first with per-doc opt-in migration. New docs are born in the CMS; existing gdocs keep working unchanged; each doc can be converted one-way to native. No write-back to Google Docs.
2. **Editor foundation**: TipTap (ProseMirror).
3. **Collaboration v1**: in-situ comments + presence/soft-locking. No real-time co-editing in v1, but the architecture must be Yjs-compatible so multiplayer (human or agent) can be enabled later.
4. **First milestone**: data insights, then articles.

---

## 1. Where we start from (codebase facts)

The investigation surfaced a very favorable starting position:

- **The enriched block tree is already the CMS data model.** ArchieML is only an ingestion syntax. Everything downstream — rendering, baking, search indexing, markdown export — consumes `OwidEnrichedGdocBlock[]` stored as JSON in `posts_gdocs.content`. The block union lives in `packages/@ourworldindata/types/src/gdocTypes/ArchieMlComponents.ts` (~65 types, with `OwidEnrichedGdocBlockTypeMap` as a ready-made type registry) and inline formatting in `.../Spans.ts` (14 span types).
- **The site renderer runs client-side.** `site/gdocs/components/ArticleBlock.tsx` dispatches every block type via `ts-pattern`; `site/gdocs/OwidGdoc.tsx` + `AttachmentsContext` provide the data context. The current admin preview iframe (`adminSiteClient/GdocsPreviewPage.tsx` → SSR route in `adminSiteServer/appClass.tsx:105`) is a historical convenience, not a necessity.
- **A full inverse serialization path exists** (`db/model/Gdoc/enrichedToRaw.ts` → `rawToArchie.ts` → `archieToGdoc.ts`), currently used for backporting. We don't need it for the native path, but it derisks migration tooling and gives us round-trip test fixtures (`exampleEnrichedBlocks.ts`).
- **Grapher renders fully client-side from a config**, and the chart editor is already factored as a reusable engine: `adminSiteClient/AbstractChartEditor.ts` + per-tab form components + a live `<Grapher>` preview, subclassed three ways (`ChartEditor`, `IndicatorChartEditor`, `NarrativeChartEditor`). This makes the "cogwheel opens chart editing in-situ" vision feasible.
- **Images are already native**: Cloudflare Images upload/management via `adminSiteServer/apiRoutes/images.ts` + `imagesHelpers.ts`, with existing picker UI (`ImageSelectorModal.tsx`, `useImages.ts`).
- **Nothing exists for comments/collaboration** — that's entirely in Google Docs today. Greenfield.
- **Attachments are the main coupling problem**: linked charts, indicators, narrative charts, images, related charts, and live data callouts are resolved server-side in `GdocBase.loadState()` into one payload (with a known N+1 per chart slug at `GdocBase.ts:744`). A live editor needs incremental resolution.

### Component usage (published docs, 2026-07 metadata)

| Rank | Type           | Instances | Docs  |     | Rank | Type                 | Instances | Docs |
| ---- | -------------- | --------- | ----- | --- | ---- | -------------------- | --------- | ---- |
| 1    | text           | 30,065    | 1,115 |     | 9    | side-by-side         | 202       | 82   |
| 2    | heading        | 4,847     | 547   |     | 10   | cta                  | 197       | 177  |
| 3    | chart          | 2,028     | 390   |     | 11   | all-charts           | 108       | 108  |
| 4    | image          | 1,302     | 816   |     | 12   | aside                | 91        | 55   |
| 5    | list           | 690       | 237   |     | 13   | chart-story          | 87        | 16   |
| 6    | prominent-link | 675       | 222   |     | 14   | research-and-writing | 75        | 70   |
| 7    | callout        | 420       | 247   |     | 15   | narrative-chart      | 54        | 29   |
| 8    | sticky-right   | 404       | 81    |     |      | _~40 more types_     | <75 each  |      |

Doc volumes: 495 articles, 435 data insights, 68 announcements, 64 topic pages, 64 linear topic pages, 18 fragments, 16 authors, 8 about pages. Data insights use almost exclusively `text` (2,255), `image` (434), `cta` (105) — ideal pilot surface. The top 8 block types cover ~95% of all instances.

---

## 2. Architecture overview

```
┌─────────────────────────── Admin (adminSiteClient) ───────────────────────────┐
│  Editor shell (new, hooks + antd, react-query)                                │
│  ┌──────────────┐  ┌────────────────────────────┐  ┌──────────────────────┐   │
│  │ Block palette │  │ TipTap editing canvas      │  │ Right rail           │   │
│  │ (per doc type,│  │ PM doc ⇄ enriched blocks   │  │ · settings           │   │
│  │ ranked by     │  │ NodeViews render existing  │  │ · comments           │   │
│  │ usage)        │  │ site/gdocs components      │  │ · (stage 2: AI chat) │   │
│  └──────────────┘  └────────────────────────────┘  └──────────────────────┘   │
│         │ EditorAttachments (react-query cache, incremental)                  │
└─────────┼─────────────────────────────────────────────────────────────────────┘
          ▼
┌────────────────────────── Admin API (adminSiteServer) ────────────────────────┐
│  POST /editor/resolve-references   (batched attachments)                      │
│  PUT  /gdocs/:id/body              (native save: draft head + revision)       │
│  POST /gdocs/:id/publish           (snapshot → posts_gdocs.content → bake)    │
│  CRUD /gdocs/:id/comments          (threads, anchored)                        │
│  POST /gdocs/:id/presence          (heartbeat)                                │
└───────────────────────────────────────────────────────────────────────────────┘
          ▼
   posts_gdocs (published content — unchanged consumers: baker, site, search)
   posts_gdocs_drafts (working copy for native docs)          [new]
   posts_gdocs_revisions (append-only history)                [new]
   posts_gdocs_comments / _comment_threads                    [new]
```

The baker, site, search indexing, and derived tables (`posts_gdocs_components`, `_links`, `_x_images`) keep consuming `posts_gdocs.content` exactly as today — the editor is a new _producer_ of that JSON, sitting beside the gdocs ingestion path rather than replacing it wholesale.

---

## 3. Document model: ProseMirror ⇄ enriched blocks

The single most important engineering artifact is a **lossless bidirectional mapping** between the ProseMirror document and `OwidEnrichedGdocBlock[]`. Everything else (rendering, saving, comments, AI edits) hangs off it.

### 3.1 Mapping strategy

Three categories of blocks:

1. **Flow content — native PM nodes** (typed and edited directly in contenteditable):
    - `text` → `paragraph`; `heading` → `heading` (with `supertitle` as node attr); `list`/`numbered-list` → PM list nodes; `blockquote`, `pull-quote`, `callout`, `aside`, `code`, `horizontal-rule`, `simple-text` → corresponding nodes.
    - Spans → PM marks/inline nodes: `span-bold/italic/underline/subscript/superscript/quote` → marks; `span-link` → link mark; `span-ref` (footnote) → inline atom node referencing the doc's refs map; `span-dod` → mark with `id` attr; `span-callout` → inline atom node (live data value); `span-newline` → hard break.

2. **Atom blocks — React NodeViews** (selectable/draggable units, not text-editable; edited via inspector UI):
    - `chart`, `narrative-chart`, `image`, `video`, `prominent-link`, `cta`, `all-charts`, `research-and-writing`, `recirc`, `table`, `chart-story`, `key-insights`, `topic-page-intro`, `additional-charts`, `guided-chart`, `static-viz`, `bespoke-component`, etc.
    - Each is a PM `atom` node whose attrs are the enriched block's props verbatim. The NodeView renders the **existing site component** (from `site/gdocs/components/`) in preview mode, wrapped in an edit chrome (hover toolbar: cogwheel → inspector, drag handle, duplicate, delete).
    - `html` blocks render sandboxed (iframe or inert) in the canvas with a source-editing inspector (CodeMirror is already in the tree).

3. **Container blocks — PM nodes with content holes**:
    - `sticky-right`/`sticky-left` (left/right), `side-by-side`, `gray-section`, `expander`, `expandable-paragraph`, `align`, `explore-data-section` → nodes with one or two child content areas that accept flow + atom nodes. Rendered with the real layout CSS so authors see actual column behavior, plus dashed drop-zone affordances.

### 3.2 Fidelity harness (build first)

Before any UI work matures, build `pmToEnriched.ts` / `enrichedToPm.ts` in a new `adminSiteClient/richEditor/serialization/` (or a shared package if the baker ever needs it) and a **corpus round-trip test**: for every published gdoc, assert `pmToEnriched(enrichedToPm(body)) ≅ body` (deep-equal modulo `parseErrors` and key ordering). This runs in CI against `exampleEnrichedBlocks.ts` and as a devTools script against a DB snapshot. Any block type that can't round-trip yet is explicitly marked **unsupported** and:

- renders in the canvas as a read-only "raw block" card (JSON preview + description),
- survives save untouched (attrs carried opaquely),
- blocks nothing: authors can edit everything around it.

This "opaque passthrough" rule is what lets us ship data insights while articles' long tail is incomplete, and lets a converted article containing an exotic block still be editable.

### 3.3 Writing flow (fluency requirements)

- **Type-first**: Enter continues paragraphs; markdown input rules (`#` → heading, `-` → list, `>` → quote, `**` → bold, etc.).
- **Slash menu**: `/` opens an inline block inserter, same registry as the palette, fuzzy-searchable, **ranked by per-doc-type usage stats** (we now have these numbers; ship them as a static ranking, refine with live telemetry later).
- **Block palette / sidebar**: full component list for the doc type, drag to insert; used for discovery, while slash menu is the fast path.
- **Paste handling**: paste from Google Docs must produce sensible blocks (PM's HTML paste rules get us most of the way; add rules for headings/lists/links). This matters enormously for adoption and for manual migration.
- **Keyboard**: arrow-key navigation through atom blocks, `Cmd+Z` undo across everything (PM native), `Cmd+K` link, etc.

### 3.4 Doc-type schemas

One PM schema, parameterized by doc type: the schema's top-level content expression and the block registry are filtered per `OwidGdocType` (e.g. data insights allow `paragraph | image | cta`; homepages allow homepage modules). Front-matter (title, authors, dateline, excerpt, refs, faqs, sticky-nav …) stays **outside** the PM doc — it remains the existing settings forms (`GdocsSettingsForms.tsx`), rendered in the right rail. Exception: `title`/`subtitle`/`excerpt` should eventually be inline-editable header fields on the canvas (plain contenteditable bound to content fields, not part of the PM doc).

---

## 4. Persistence, drafts, versions

### 4.1 Storage

- `posts_gdocs` gains `authoringMode ENUM('gdocs','native') NOT NULL DEFAULT 'gdocs'` (migration). Native docs get generated ids (e.g. `nd_<nanoid>` or UUID — must not collide with Google doc id shape; several code paths regex-match gdoc ids, audit those).
- **`posts_gdocs.content` remains the published/live content** for published docs — this keeps the baker, site, search, and derived-table pipelines untouched.
- New table `posts_gdocs_drafts`: `(gdocId PK/FK, content JSON, updatedAt, updatedBy, baseRevisionId)` — the working copy the editor loads and saves. For unpublished native docs the draft _is_ the doc.
- New table `posts_gdocs_revisions`: `(id, gdocId, content JSON, createdAt, createdBy, kind ENUM('autosave','manual','publish'), label NULL)` — append-only. Autosaves are pruned (keep last N + daily snapshots); `publish` revisions are kept forever. This gives us history/restore, which today authors get from Google Docs revision history — we must not regress it.

### 4.2 Save & publish flow

- **Autosave**: debounced (~2s idle / 30s max) `PUT /api/gdocs/:id/body` with `{content, baseRevisionId}`. Server validates (reuse `rawToEnriched`-level validation + `GdocBase.validate` semantics: image filenames exist, chart slugs resolve, etc. — returning `parseErrors`-style warnings that the client surfaces inline on blocks), writes draft head, appends autosave revision (throttled).
- **Optimistic concurrency**: if `baseRevisionId` doesn't match the draft head, return 409 with the newer revision — client shows "Marcel saved a newer version" and offers reload/overwrite. Combined with presence (below) this is our v1 conflict story.
- **Publish**: `POST /api/gdocs/:id/publish` snapshots draft → `posts_gdocs.content`, sets published flags, then reuses the existing `createOrUpdateGdoc` tail: derived-table updates, `indexAndBakeGdocIfNeccesary` (Algolia + bake/lightning deploy). The publishing-action logic in `gdocsDeploy.ts` carries over.
- The existing `PUT /api/gdocs/:id` (settings/metadata save) is kept but must stop clobbering body for native docs — refactor `createOrUpdateGdoc` to treat body and settings as separate concerns.
- **Guard rails**: gdocs-mode docs reject body PUTs; native docs are skipped by the "refetch from Google" path in `getIndividualGdoc` (`apiRoutes/gdocs.ts:99`) and by `fetchAndEnrichGdoc`.

### 4.3 Yjs-compatibility (forward-looking, cheap now)

We do **not** run a sync server in v1. To keep the door open for real-time and agent collaboration:

- All editor mutations go through PM transactions (never direct state pokes) — this is the invariant Yjs binding (`y-prosemirror`) needs.
- Store revisions as full JSON (not diffs), so switching the source of truth to a Yjs document later only changes the transport/merge layer, not history.
- Comment anchoring via marks (see §6) is the y-prosemirror-compatible choice.
- When we adopt Yjs (M5+), the draft head becomes a Yjs doc (`ydoc` blob column or separate store), websocket provider (e.g. `y-websocket`/Hocuspocus) added to the admin server, and 409-conflict handling disappears.

---

## 5. Live rendering & attachments

### 5.1 Rendering site components in the admin

- The monorepo already lets `adminSiteClient` import from `site/` (both are bundled by Vite). NodeViews wrap `ArticleBlock`-level components; the canvas is wrapped in the site's `.article-block`/grid CSS plus `AttachmentsContext.Provider` fed by the editor's attachment cache.
- **Style isolation**: scope site styles under an `.rich-editor-canvas` wrapper class (import `owid.scss` entry into a scoped layer or a dedicated canvas stylesheet) so admin chrome (antd) and article styles don't fight. This needs a spike early — it's the kind of thing that's 90% fine and 10% annoying (global resets, `:root` variables).
- **Performance**: charts are heavy. In the canvas, atom NodeViews mount lazily via IntersectionObserver; charts render as static thumbnail (existing dynamic-thumbnail endpoints) until scrolled into view or focused, then hydrate to live `<Grapher>`. Container drag operations use a lightweight placeholder rendering.

### 5.2 Incremental attachment resolution

New endpoint `POST /api/editor/resolve-references` accepting `{chartSlugs?, narrativeChartNames?, filenames?, gdocIds?, indicatorIds?, staticVizNames?}` and returning the corresponding slices of the `Attachments` shape (`site/gdocs/AttachmentsContext.ts`). Implementation reuses/extracts the loaders from `GdocBase.loadState` (`loadLinkedCharts`, `loadImageMetadataFromDB`, `loadNarrativeChartsInfo`, …), **batched** (fixing the N+1 at `GdocBase.ts:744` — a win the SSR path inherits too).

Client-side: a react-query-backed `EditorAttachmentsStore` that

- extracts references from the PM doc (same logic as the enriched-side `GdocBase` link extraction, ported to run over PM nodes),
- fetches missing ones on doc load and on block insert/edit (e.g. author picks a chart in the inspector → resolve → NodeView rerenders),
- feeds `AttachmentsContext` so site components work unmodified.

Some context is doc-level rather than reference-level (`relatedCharts` from tags, `latestDataInsights`, `homepageMetadata`, `donors`, `linkedCallouts` values): expose these as named scopes in the same endpoint (`{scopes: ["relatedCharts"]}`), fetched when the doc type/blocks need them.

### 5.3 Block inspector & chart pickers

Each atom block type registers: `{type, icon, label, docTypes, usageRank, inspector: React component, defaultProps}`. The inspector is a right-rail panel (or popover for small blocks) with a typed form for the block's props — antd forms, reusing existing pickers: `ImageSelectorModal` for images, a new chart search picker (backed by the existing charts admin list endpoint) for `chart`/`narrative-chart`, tag pickers, etc. This registry also powers palette + slash menu.

---

## 6. Comments & presence (v1 collaboration)

### 6.1 Data model

- `posts_gdocs_comment_threads`: `(id, gdocId, status ENUM('open','resolved','orphaned'), anchorType ENUM('range','block','document'), createdAt, resolvedAt, resolvedBy)`
- `posts_gdocs_comments`: `(id, threadId FK, userId FK, text, createdAt, updatedAt)` — plain text/limited markdown v1.

### 6.2 Anchoring

- **Text-range threads**: a PM mark `comment(threadId)` on the range. Marks move naturally with edits, survive splits/joins, and serialize into the draft JSON. On save, threads whose marks vanished (text deleted) get `status='orphaned'` and appear in an "orphaned comments" list rather than disappearing — same UX idea as gdocs.
- **Block threads**: atom blocks can't carry text marks; give every block a stable `blockId` attr (nanoid, generated on insert/conversion, persisted into the enriched JSON as an optional field — additive change to the block types) and anchor `anchorType='block'` threads to it. Block ids also become the anchor for AI edits, deep links, and analytics later — worth introducing regardless of comments.
- **Serialization consequence**: enriched block types get two optional additive fields: `blockId?: string` and (inside text values) comment marks must round-trip. For v1 we can keep comment marks **only in the draft JSON** (drafts are the editing surface); on publish, marks are stripped from `posts_gdocs.content` so the public payload stays clean. Orphaning check runs at publish time too.
- Published-doc rendering is untouched; comments are an editor-surface feature.

### 6.3 UI

Right-rail comments panel (all threads, filterable, resolve/reopen) + inline: highlighted ranges, gutter bubbles next to blocks, floating "add comment" on selection. Notifications: v1 = in-admin badge on the gdocs index + optional Slack webhook ping to the doc's authors (we already post to Slack from other admin flows); email digests later.

### 6.4 Presence & soft locking

- `POST /api/gdocs/:id/presence` heartbeat every ~20s while the editor is open; `GET` returns active editors. Banner: "Fiona is editing this document" with avatars. This is advisory — the 409 optimistic-concurrency check (§4.2) is the actual protection.
- No hard locks: OWID is a small, high-trust team; hard locks cause more pain (stale locks) than they prevent.

---

## 7. In-situ chart editing (the cogwheel)

Staged deliberately, because "edit this chart from the article" has a product subtlety: **grapher charts are shared entities** — mutating one from inside an article changes it on its data page and every other embed. The block model already has the right answer: **narrative charts** (chart views) exist precisely to be article-scoped variants of a parent chart.

- **Stage A (articles milestone)**: cogwheel opens the block inspector — embed options (size, height, caption via existing props, tab/query params). "Open in chart editor" links out (current behavior, one click instead of URL surgery).
- **Stage B**: cogwheel offers **"Customize this chart"** → creates (or edits) a narrative chart from the embedded parent via the existing `saveAsNarrativeChart` flow, and opens an **overlay editor** around the live chart in the canvas: the `NarrativeChartEditor` engine (`AbstractChartEditor` subclass) with a curated subset of tabs (basic/text/customize) rendered in a side-over panel, live-updating the in-canvas `<Grapher>`. Prereq refactor: extract `Editor*Tab` + editor engine usage out of `ChartEditorPage`'s page assumptions (disable `setupTabUrlSync`/`readInitialTabFromUrl`, no `AdminLayout`, no router `<Prompt>`) behind an `embedded?: boolean` context. This refactor is mechanical; the tab components already take `editor` as a prop.
- **Stage C (optional, later)**: same overlay for parent charts for users with chart-edit permissions, with a loud "this changes the chart everywhere" affordance.

---

## 8. Migration (per-doc opt-in)

- **"Convert to native editing"** action on the gdoc preview page (and index): server re-fetches the freshest content from Google (`fetchAndEnrichGdoc`), stores it as the native draft, sets `authoringMode='native'`, records `convertedFromGdocAt`, and (via Drive API, which we already auth for) renames the Google Doc with a `[MIGRATED — edit in admin]` prefix and/or inserts a banner paragraph. One-way; a "revert to gdocs" escape hatch during the beta = flip the flag back (the gdoc is still there, minus any native edits — warn accordingly).
- Conversion report: run the round-trip fidelity check on the doc and show the author exactly which blocks (if any) fall into opaque-passthrough mode before they commit.
- Google-doc-specific admin UI (diff view against live gdoc, "preview suggestions", `GdocsEditLink`) hides for native docs; revision history UI replaces it.
- The gdocs ingestion pipeline is **not** dismantled until stated doc types reach ~100% native adoption; fragments/homepage/authors can stay on gdocs indefinitely if migration isn't worth it. `posts_gdocs_tombstones`, redirects, tags, etc. are unaffected (they key off the row, not the authoring mode).

---

## 9. AI side panel (stage 2 — design constraints now)

Not built in v1, but v1 choices should make it cheap:

- **Structural edit API**: because all mutations are PM transactions, the AI integration is a set of tools operating on the doc via a command layer: `insertBlock(afterBlockId, block)`, `replaceBlock(blockId, block)`, `moveBlock(blockId, targetPos)`, `editTextRange(blockId, from, to, newSpans)`, `setBlockProps(blockId, props)`. Block ids (§6.2) are the addressing scheme. These same commands back keyboard/palette/DnD interactions — one code path, agent and human alike.
- **Chat UI**: third tab in the right rail. Requests go to the admin server which proxies the Claude API with the doc (as enriched JSON — compact, typed, already the model's best representation) + tool definitions. Tool calls are applied as PM transactions client-side.
- **Suggestions, not silent edits**: agent edits should land as reviewable suggestions. ProseMirror has viable track-changes patterns (mark-based insert/delete decorations); this is also the natural meeting point with the comments system (an AI reply in a thread can carry a proposed edit). Full spec deferred to the stage-2 plan.
- **Later**: with Yjs adopted, agents become long-lived collaborators on the shared doc (Daniel's note: Yjs likely matters for efficient agent collab, not just human multiplayer).

---

## 10. Milestones

**M0 — Foundation (no user-facing ship)**

- PM schema + `enrichedToPm`/`pmToEnriched` for: text (all common spans), heading, list, numbered-list, image, cta, horizontal-rule, blockquote, callout.
- Corpus round-trip harness (CI + devTools script against DB snapshot); opaque-passthrough raw block.
- `authoringMode` migration; `posts_gdocs_drafts` + `posts_gdocs_revisions`; body save endpoint with validation + 409s.
- `resolve-references` endpoint (charts batched — fixes N+1; images; narrative charts).
- Editor shell behind a feature flag: canvas, slash menu, palette, autosave, style-isolation spike, image NodeView using `ImageSelectorModal`.
- Exit criterion: an engineer can create, edit, save, and restore a native test doc; round-trip green on 100% of published data insights and ≥95% of all published docs.

**M1 — Data insights GA**

- DI-specific: doc-type schema (text/image/cta), DI settings form integration, image reupload flow, publish → bake path, DI feed correctness.
- Comments v1 (range + block threads, resolve, orphan handling), presence banner, revision history UI (list, view, restore).
- "Convert to native" for DIs + conversion report; new-DI flow defaults to native.
- Exit criterion: authors write real data insights natively end-to-end; new DIs no longer created in gdocs.

**M2 — Articles beta**

- Remaining top blocks as first-class: chart (live Grapher NodeView + chart picker + lazy hydration), prominent-link, sticky-right/left, side-by-side, gray-section, aside, pull-quote, expandable-paragraph, table, recirc, research-and-writing, all-charts, narrative-chart, video.
- Refs/footnotes editing, DoD span UI, title/subtitle/excerpt inline fields.
- Cogwheel Stage A (inspector + embed options).
- Per-doc conversion opened to articles; opaque-passthrough covers the tail (chart-story, html, bespoke-component, guided-chart… promoted to first-class on demand).
- Exit criterion: several real articles authored/edited natively, including at least one with sticky-right layout and 10+ charts, with acceptable canvas performance.

**M3 — In-situ chart editing**

- Chart-editor engine extraction (`embedded` mode); "Customize this chart" → narrative chart creation + overlay editing (Stage B).

**M4 — AI side panel** (separate detailed plan when we get there)

- Command layer hardening, chat rail, Claude API proxy, suggestion/track-changes mode.

**M5+ — Real-time & long tail**

- Yjs adoption (sync server, live cursors, agent collaborators); topic pages / linear topic pages / remaining doc types; retire gdocs ingestion for migrated types.

---

## 11. Risks & mitigations

| Risk                                        | Mitigation                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Round-trip infidelity corrupts content      | Corpus harness in CI from M0; opaque-passthrough for anything not proven; publish revisions are immutable, restore always possible.                           |
| Site CSS vs admin CSS conflicts in canvas   | Early spike; scoped canvas stylesheet; worst case, canvas in a same-origin iframe with a postMessage bridge (last resort — breaks the NodeView model, avoid). |
| Canvas performance with many live charts    | Thumbnail-until-visible/focused hydration; virtualized rendering if needed; measured against the heaviest real articles in M2 exit criteria.                  |
| Comment anchors drift/orphan                | Mark-based anchors + explicit orphaned state; never silently drop a thread.                                                                                   |
| Two authoring pipelines forever             | Per-doc-type "default to native" switches + adoption dashboards; explicit retirement criterion per doc type; keep migration one-way so the set only grows.    |
| Team adoption / fluency regression vs gdocs | DIs first (small blast radius); paste-from-gdocs quality bar; revision history at parity before pushing conversion; authors involved from M1 beta.            |
| Native doc ids break gdoc-id assumptions    | Audit id-shape assumptions in M0 (link resolution, `gdocIdRegex`-style checks, preview routes).                                                               |

---

## 12. Open questions (to resolve during M0/M1)

1. Draft-preview parity: do we keep an SSR "exact preview" route for native drafts (render draft content through the baker path) as a safety net next to the live canvas? (Cheap: yes, at least initially.)
2. Where comment marks live long-term (draft-only vs also in published JSON, stripped at bake) — proposal above says draft-only; revisit when suggestions/track-changes arrive.
3. Do fragments (details-on-demand dictionary, FAQs) get an editor surface in M2 or stay in gdocs? (DoD editing affects article flow.)
4. Notification story beyond Slack ping (email digests? in-admin inbox?).
5. Whether `title`/`subtitle` move into the canvas in M1 (DIs would benefit) or M2.
