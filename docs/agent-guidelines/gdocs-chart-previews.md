# Chart preview images in Google Docs

Chart components in a gdoc are just text (`{.chart}` / `url: …` / `{}`), so authors paste a PNG of the chart right above the component to see what they're writing about. Those PNGs go stale when the chart changes. `db/model/Gdoc/chartPreviews/` keeps them current by writing into the Google Doc itself.

## How it works

1. **Find components** (`chartPreviewBlocks.ts`) — walks the raw Docs API document in _all_ tabs (fetched with `includeTabsContent: true`, unlike ingestion, which only reads the first tab), including table cells. It matches `{.chart}` objects and single-line `chart: <url>` components. The preview image is the last inline image of the closest non-blank paragraph above the component, either in its own paragraph or at the end of a text paragraph.
2. **Resolve the image URL** (`chartPreviewSources.ts`) — maps each component to a public PNG. Standalone charts render via `/grapher/by-uuid/<configId>.png` (so drafts work too) plus the link's query string. The URL ends in `v=<hash>`, a hash of the config's `configMd5` and the `dataChecksum`/`metadataChecksum` of the indicators it uses.
3. **Diff and write** (`refreshGdocChartPreviews.ts`) — Google records the URL an image was inserted from as `sourceUri`, so an image is up to date exactly when its `sourceUri` equals the URL we'd insert now. We don't need our own bookkeeping table. Outdated or hand-pasted images are swapped with `replaceImage`, which keeps the object id and the size in the doc. With `insertMissing`, components without an image get one in a new paragraph above. Each URL is fetched once beforehand. That warms the Cloudflare cache and catches broken renders, because a single URL Google can't fetch fails the whole `batchUpdate`. If the batch fails anyway, each change is retried on its own. All writes target the revision we read, so Google adjusts positions for edits authors make meanwhile.

Inline images are ignored by `gdocToArchie`, so none of this affects ingestion.

## Entry points

- Admin: "Update chart images in gdoc" in the gdoc preview page's ⋮ menu (`POST /api/gdocs/:gdocId/refreshChartPreviews`).
- CLI / cron: `yarn refreshGdocChartPreviews [--insert-missing] [--dry-run] [--changed-since-hours <n>] [gdocId…]`. `--changed-since-hours` selects the gdocs that link to charts whose config or data changed recently (via `posts_gdocs_links`). This is generous, but docs whose images are current cost only a read.

## Settings and local testing

Google fetches the images itself, so their base URL must be public: `GDOCS_CHART_PREVIEW_GRAPHER_URL` (defaults to `GRAPHER_DYNAMIC_THUMBNAIL_URL`). Locally and on staging, set it to `https://ourworldindata.org/grapher`. Config ids are the same as in production for charts that exist there, so the images render correctly. To resolve charts newer than your local DB, point the script at a recent staging DB with `STAGING=<branch>`; it only reads from the DB.
