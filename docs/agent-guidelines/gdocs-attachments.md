# Google Docs Attachments

Attachments are the extra bits of data that accompany a rendered Google Doc: linked authors, referenced charts, image metadata, donor lists, etc. They are loaded on the server alongside the document content and exposed to React pages through the `AttachmentsContext`. This document describes how attachments are prepared, how pages consume them, and the current constraints of the system.

## Where Attachments Are Loaded

All Google Doc subclasses inherit the attachment workflow from `GdocBase` (`db/model/Gdoc/GdocBase.ts`):

1. `loadState(knex)` orchestrates attachment loading **after** the document has been parsed into enriched blocks.
2. Each helper method populates a different slice of state on the instance:
    - `loadLinkedAuthors` → `linkedAuthors`: batched lookup of published author pages via `getMinimalAuthorsByNames`.
    - `loadLinkedDocuments` → `linkedDocuments`: single query (`getMinimalGdocPostsByIds`) for referenced Google Docs.
    - `loadImageMetadataFromDB` → `imageMetadata`: batch query (`getImageMetadataByFilenames`) driven by filenames extracted from blocks, linked docs, and referenced authors.
    - `loadLinkedCharts` → `linkedCharts`: fetches Grapher, Explorer, or MultiDim configs for all linked slugs. (Currently an `O(n)` set of queries; see limitations below.)
    - `loadLinkedIndicators` → `linkedIndicators`: derives indicator metadata for datapage-linked charts.
    - `loadNarrativeChartsInfo` → `linkedNarrativeCharts`: fetches metadata for referenced narrative charts.
    - Subclass overrides `_loadSubclassAttachments` to append type-specific data (e.g., donor names, homepage metrics, latest insights, author “latest work” tiles).
3. `validate` runs after attachments are loaded so that missing metadata (images, authors, links, etc.) can trigger contextual errors.

Because attachments are populated directly onto the `GdocBase` instance, they are automatically included in `extractGdocPageData` (`packages/@ourworldindata/utils/src/Util.ts:1314`), which shapes the payload handed to React pages.

## How Pages Receive Attachments

### Single-document pages

`OwidGdoc` (`site/gdocs/OwidGdoc.tsx:70`) wraps the rendered page with `AttachmentsContext.Provider`, passing through the attachment fields exposed on `OwidGdocPageProps`. Individual blocks and components consume the context via helper hooks in `site/gdocs/utils.ts`:

- `useLinkedAuthor`, `useLinkedDocument`, `useLinkedChart`, `useLinkedIndicator`
- `useImage`, `useDonors`, `useLinkedNarrativeChart`

Examples:

- The “All Charts” block pulls `relatedCharts` and `tags` from the context to render the key-charts grid (`site/gdocs/components/AllCharts.tsx`).
- The research-and-writing block reads `latestWorkLinks` to show author content (`site/gdocs/components/ResearchAndWriting.tsx`).
- Homepage components depend on `homepageMetadata` and `latestDataInsights` to render counts and cards.

### Multi-document contexts

Some pages aggregate attachments from multiple sources before providing them:

- `DataInsightsIndexPageContent` merges image metadata, authors, charts, and linked documents from every data insight on the page before creating a single provider (`site/DataInsightsIndexPageContent.tsx:103`).
- MultiDim datapage views use the same context to expose chart image metadata to components that reuse shared rendering code (`site/multiDim/MultiDimDataPageContent.tsx:380`).
- Static rendering (`baker/siteRenderers.tsx`) injects attachments when baking HTML, including tombstone pages.

Pages that do not rely on Google Docs (e.g., WordPress articles) bypass this system entirely.

## Subclass-specific Attachments

- **`GdocPost`** uses `_loadSubclassAttachments` to fetch `relatedCharts` when the document contains an “all charts” block and has tags (`db/model/Gdoc/GdocPost.ts:140`). It also exposes parsed FAQ content through `_getSubclassEnrichedBlocks`.
- **`GdocDataInsight`** fetches `latestDataInsights` plus their image metadata so that we can surface related insights or previews (`db/model/Gdoc/GdocDataInsight.ts:55`).
- **`GdocHomepage`** collects site metrics (`homepageMetadata`) and recent insights each time the homepage is loaded (`db/model/Gdoc/GdocHomepage.ts:61`).
- **`GdocAbout`** loads donor names when the document references a donors block (`db/model/Gdoc/GdocAbout.ts:20`).
- **`GdocAuthor`** retrieves “latest work” cards and associated images (`db/model/Gdoc/GdocAuthor.ts:76`).
- **`GdocAnnouncement`** currently only inherits the base attachments.

## Limitations and Trade-offs

- **Multiple round-trips for charts**: `loadLinkedCharts` still performs one query per grapher slug (`db/model/Gdoc/GdocBase.ts:744`). The inline TODO notes we should batch this into a single query; today, heavily linked posts can trigger dozens of round-trips.
- **Sequential loading**: `loadState` awaits each attachment loader in order. Dependencies (e.g., indicators rely on charts) require this sequencing, but it means high-latency queries delay the entire load. There is no concurrency between independent loaders.
- **No cross-document caching**: Attachments are recomputed per request. Rendering the homepage and the data insights index in the same bake run will fetch the latest insights twice.
- **Published-only lookups**: author attachments only consider published author pages with matching titles; unpublished authors cause validation warnings but no attachment data.
- **Attachment payload growth**: every attachment is serialized into the page payload. Documents that link to many charts, images, or related posts can substantially increase the JSON footprint.
- **Index aggregation is shallow**: pages like the data insights index simply merge attachment maps (`_.merge`) and deduplicate authors by name. Conflicts are resolved by last-write wins, which is acceptable for current use cases but can mask discrepancies if two insights embed different metadata for the same slug.
- **Subclass fetches are eager**: homepage and data insight pages always trigger their extra queries (latest insights, site metrics) even if the blocks are hidden or unused in a given template.

## Batch vs. Single-item Fetches

| Attachment type           | Loader                            | Query strategy                         |
| ------------------------- | --------------------------------- | -------------------------------------- |
| Authors                   | `loadLinkedAuthors`               | Single `IN` clause on author titles    |
| Linked documents          | `loadLinkedDocuments`             | Single `IN` clause on document IDs     |
| Images                    | `loadImageMetadataFromDB`         | Single `IN` clause on filenames        |
| Grapher / Explorer charts | `loadLinkedCharts`                | **Per-slug lookup** (`Promise.all`)    |
| Indicators                | `loadLinkedIndicators`            | Batched query using indicator IDs      |
| Narrative charts          | `loadNarrativeChartsInfo`         | Single batched query                   |
| Related charts            | `GdocPost.loadRelatedCharts`      | Batched query filtered by tags         |
| Latest insights           | `getLatestDataInsights`           | Single query + batched image lookup    |
| Author latest work        | `GdocAuthor.loadLatestWorkImages` | Single query for work + batched images |

Understanding these hotspots helps when optimising for new features. For example, when adding another attachment type, prefer the existing “batch with `IN` clause” pattern to avoid the N+1 behaviour that currently exists for charts.

## Extending Attachments

When a new block or document type needs auxiliary data:

1. Add fields to the relevant `OwidGdoc…` interface in `packages/@ourworldindata/types`.
2. Populate those fields during `_loadSubclassAttachments` (or a new helper called in `loadState`).
3. Expose the data through `extractGdocPageData`.
4. Consume it via `AttachmentsContext` on the front-end.
5. If necessary, update `DataInsightsIndexPageContent`, `baker/siteRenderers`, or other aggregate providers so multi-document pages pass through the new data.

Keep an eye on batching (avoid per-item lookups), payload size, and validation requirements as you extend the attachment system.
