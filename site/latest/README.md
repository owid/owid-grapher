# Latest Page Architecture Documentation

## Overview

The `/latest` page is a single-page app that renders a chronological feed of all editorial content — articles, data insights, announcements, data updates, and website upgrades — with topic and content-type filters and infinite scroll.

The baker emits a shell page ([`site/LatestPage.tsx`](../LatestPage.tsx)) carrying only the topic tag graph; everything else mounts client-side.

> **Sibling to `/search`.** `/latest` is built as a deliberate architectural parallel to the site search ([`site/search/README.md`](../search/README.md)): both are Algolia-backed SPAs mounted into a baked shell, both treat the URL as the source of truth for filter state, both colocate Algolia query construction in [`queries.ts`](../search/queries.ts), and a number of smaller pieces — the Algolia client, the topic-graph hook, URL helpers, a couple of UI primitives — come directly from search.

## Key Architectural Patterns

### 1. Records carry their own attachment context

Gdoc components (images, article blocks, linked-author pills, …) normally render inside an `AttachmentsContext` populated server-side from DB joins (image metadata, linked charts, linked documents, linked authors). With cards rendered purely client-side from Algolia hits, an Algolia record has to carry enough of that context for the card to render with no further fetches.

The contract has two ends:

- **Indexing side** (in [`baker/algolia/utils/pagesChronological.ts`](../../baker/algolia/utils/pagesChronological.ts)) decides, per content type, which linked content to load from the DB and which fields to write onto the record. A `ts-pattern` `.exhaustive()` match enforces that adding a new content type forces an explicit choice on each side.
- **Rendering side** (in [`makeAttachments`](./latestUtils.ts) here) reads those fields back out into the shape gdoc components expect, then wraps each card in an `AttachmentsContext.Provider`.

### 2. Two indexing paths, one record shape

Two callers reindex chronological gdocs into Algolia:

- **Bulk reindex**, run by the baker on full deploys. Walks all published chronological gdocs, loads linked content from the DB, then builds records.
- **Individual reindex**, triggered from the admin when a single gdoc is published or updated. The admin already populates the gdoc's linked content as part of its save flow, so it skips the DB-loading step and goes straight to building the record.

Both paths converge on the same record-builder, so a record produced by either path has the same shape.

### 3. URL is the source of truth for filter state

Active type and topic set are decoded from the URL on every render — there is no separate React state mirror. The `/search` page already established this pattern; `/latest` reuses the same shape:

- Unknown, invalid, or legacy params are stripped on first paint via `replaceState` (so e.g. `?topic=…` URLs from the retired `/data-insights` page sanitize themselves).
- Filter mutations rebuild URLs from validated state rather than copying existing query params, so cruft can't sneak back in.

See [`latestState.ts`](./latestState.ts) and its tests.

### 4. One batched search drives the whole UI

A single Algolia call ([`queryLatestPages`](../search/queries.ts)) issues three queries in one round-trip: the paginated card list, plus per-axis facet counts. Each facet-count query intentionally drops its own axis so the counts answer "what would happen if I picked a different value here?" rather than self-narrowing to the current selection. That's what disables zero-match options in the type dropdown and the topic pills without a second round-trip.

### 5. `latestType` is a derived field for the content-type filter

The `/latest` filter offers five options: article, data insight, data update, website upgrade, announcement. The first two are distinct gdoc types, but the last three are all _announcement_ gdocs distinguished only by their editorial _kicker_. The indexer derives a `latestType` per record (kicker for announcements, gdoc type otherwise) so the filter can treat them as five separate values. The raw gdoc type stays on the record for card dispatch and the atom feed.

### 6. Card variants: authored (articles) and view-driven (data insights)

Articles expose two card-only override fields, and each follows the same shape: an authoring choice in the gdoc → conditional behavior in the indexer (which linked content to load) → variant rendering in the card.

`latest-feed-featured-image` swaps the card thumbnail (the article page itself still uses `featured-image`). `latest-feed-excerpt` switches the excerpt from the default plain text to ArticleBlocks (with internal links and formatting) plus a "Read the article" affordance — see [`LatestArticleHit`](./LatestArticleHit.tsx). The rich-excerpt path is also why the indexer conditionally loads linked charts/documents for articles.

Data insights vary by _where_ they render, not by authoring. In the unfiltered feed they're a condensed teaser linking to their page. With the data-insight type filter on, the feed instead shows each insight whole, read in place, and offers a **View: Expanded / Compact** toggle ([`LatestViewToggle`](./LatestViewToggle.tsx)) — a grid item of its own, rendered before the cards it governs, sitting at the top of the right-hand column above the newsletter block on desktop and at the top of the page on mobile — compact cards clip the text and expand in place on click, one-way. The toggle is local UI state, not URL state, and resets when the type filter changes. It renders only for the type filters that offer it, so its absence is what says "not applicable here" — which means the feeds that have one sit 40px lower on mobile, where the toggle takes a row of its own. The baked skeleton can't know the active filter (one static shell serves every query string), so it renders no toggle and a deep-linked filtered feed gains one when the app mounts. Which type filters offer it is a list, `LATEST_TYPES_WITH_VIEW_TOGGLE` in [`latestUtils.ts`](./latestUtils.ts), so extending it to data updates is a matter of adding the type and having its hit component honour `view`. The in-place card needs the authors' avatars, which is why the indexer loads `linkedAuthors` for data insights.

Announcements and data updates render one way each, so the indexer loads their linked content unconditionally.

### 7. Standalone announcement pages are a preview surface

Each announcement is also baked as a standalone page, primarily for editor preview. Nothing on the site links to it and there's no back-nav — not by design, just unaddressed (compare data insight permalinks, which are shareable and breadcrumb back to `/latest?type=data-insight`). The bake is kept in case we make announcement URLs shareable later.

## Component layout

```
LatestSearchWrapper            (Algolia LiteClient + QueryClientProvider)
  └── LatestSearch             (URL state, queries, result list)
        ├── LatestTopicFacets  (topic pills + content-type dropdown)
        ├── LatestViewToggle   (Expanded / Compact; disabled unless the type filter offers it)
        └── LatestHit          (per-type dispatcher)
              ├── LatestArticleHit
              ├── LatestDataInsightHit
              │     └── LatestDataInsightExpandable  (filtered feed: read in place)
              ├── LatestDataUpdateHit
              └── LatestAnnouncementHit
```
