# Latest Page Architecture Documentation

## Overview

The `/latest` page is a single-page app that renders a chronological feed of all editorial content — articles, data insights, announcements, data updates, and website upgrades — with topic and content-type filters and a Load more button.

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

The type filter distinguishes articles, data insights, and announcement kinds such as data updates and website upgrades. The indexer derives `latestType` from the gdoc type or announcement kicker. The original gdoc type remains on the record for card dispatch and the atom feed.

### 6. Card variants: index-time vs. render-time

Every content type renders more than one way in the feed. What matters for the indexer is _when_ that choice is made:

- **Index time** — articles only. The choice is authored in the gdoc, so the indexer can see it and load (and store) just what that variant needs.
- **Render time** — everything else. The variant depends on the active filter, a toggle, or a click, none of which exist when the record is built. The indexer therefore loads linked content unconditionally: every variant has to render from the record alone, with no further fetch.

**Articles** expose two card-only override fields, each following the same shape: an authoring choice in the gdoc → conditional behavior in the indexer → variant rendering in the card. `latest-feed-featured-image` swaps the card thumbnail (the article page itself still uses `featured-image`). `latest-feed-excerpt` switches the excerpt from the default plain text to ArticleBlocks (with internal links and formatting) plus a "Read the article" affordance — see [`LatestArticleHit`](./LatestArticleHit.tsx). The rich-excerpt path is why the indexer conditionally loads linked charts/documents for articles.

**Data insights** vary by _where_ they render. In the unfiltered feed they're a condensed teaser linking to their page. With the data-insight type filter on, the feed offers a **View: Expanded / Compact** toggle ([`LatestViewToggle`](./LatestViewToggle.tsx)): Expanded shows each insight whole, read in place ([`LatestDataInsightExpanded`](./LatestDataInsightExpanded.tsx)); Compact is the very same teaser as the unfiltered feed — one card design, one behaviour, wherever it appears.

**Announcements and data updates** collapse to a teaser in the unfiltered feed and show their full body once the type filter is on — or, for announcements, once the reader clicks _Read more_ ([`ExpandableText`](./ExpandableText.tsx)). Both transitions happen in the browser from data the record already carries.

### 7. Standalone pages

Data insights and announcements share `StandalonePostBody`, an avatar byline, related topics, and copy-link controls. Their breadcrumb returns to the corresponding type-filtered feed. Announcement pages include a carousel of recent announcements of the same kind, excluding the current page; compact data-update cards link to these pages.

### 8. Sticky filters experiment

`exp-latest-sticky-filters-v1` compares `not-sticky`, `reveal-on-scroll-up`, and `fully-sticky` on `/latest`. The edge middleware adds the arm's body class; [`LatestSearch.scss`](./LatestSearch.scss) applies the layout to both the baked shell and the mounted app. Every arm uses the same static topic popularity ranking from [`latestUtils.ts`](./latestUtils.ts).

The sticky element is the facets grid item, giving it the feed's height to move within. On mobile the type dropdown moves above the topic pills; a negative pin offset lets the dropdown scroll away.

For the reveal arm, [`useRevealOnScrollUp`](./latestHooks.ts) tracks scroll direction and measures the bar's height. CSS transitions `top` between the pin offset and an offset one bar-height above it. Sticky positioning keeps the bar in its normal flow position near the top of the page, avoiding the displacement a transform would cause there. Two custom properties carry the pin offset and measured height. Until the height is available, `top` computes to `auto`; padding stays constant so the measurement remains valid.

To force an arm on staging or a Cloudflare preview, set the `exp-latest-sticky-filters-v1` cookie to the arm's id on path `/` and reload: the middleware assigns only when the cookie is absent, so an existing one is honoured and the body class follows from the first byte. Plain `make up` runs no middleware, so nothing stamps the class — the cookie alone drives the hook, and the arm's layout needs `exp-latest-sticky-filters-v1--<arm>` added to `<body>` by hand. `SiteAnalytics` includes `experimentArm` on `/latest` events.

## Component layout

```
LatestSearchWrapper            (Algolia LiteClient + QueryClientProvider)
  └── LatestSearch             (URL state, queries, result list)
        ├── LatestTopicFacets  (topic pills + content-type dropdown)
        ├── LatestViewToggle   (Expanded / Compact; shown for supported type filters on desktop)
        └── LatestHit          (per-type dispatcher)
              ├── LatestArticleHit
              ├── LatestDataInsightHit
              │     └── LatestDataInsightExpanded  (filtered feed, Expanded view: read in place)
              ├── LatestDataUpdateHit
              └── LatestAnnouncementHit
```
