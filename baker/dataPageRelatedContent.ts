// Bake-time enrichment for the data-page "Keep exploring" section.
//
// Takes the algorithmic RelatedItem[] produced by the related-content pipeline
// (db/model/RelatedContent/pipeline.ts) and joins each URL against
// posts_gdocs and chart_configs to produce rich items (thumbnails, excerpts,
// authors, dates, subtitles) that the renderer can SSR without dragging in
// Algolia at runtime.

import {
    DbEnrichedPostGdoc,
    DbRawPostGdoc,
    DEFAULT_GDOC_FEATURED_IMAGE,
    EnrichedBlockImage,
    EnrichedRelatedItem,
    ImageMetadata,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
    parsePostsGdocsRow,
    RelatedItem,
    spansToUnformattedPlainText,
    traverseEnrichedBlock,
} from "@ourworldindata/utils"
import * as db from "../db/db.js"
import {
    BAKED_BASE_URL,
    CLOUDFLARE_IMAGES_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { stripCustomMarkdownComponents } from "../db/model/Gdoc/enrichedToMarkdown.js"
import { mapGrapherTabNameToQueryParam } from "@ourworldindata/grapher"
import {
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherTabName,
} from "@ourworldindata/types"

// Target length of the body-preview string for article / topic-page /
// data-insight cards. Roughly maps to ~6 lines in the rendered card,
// which is what the CSS line-clamp + fade then bounds.
const BODY_PREVIEW_TARGET_CHARS = 700

// Cap on distinct attributions joined into the source line. Beyond this
// we truncate to "<first> and other sources" — same threshold and phrasing
// as buildSourcesLineFromColumns in
// packages/@ourworldindata/grapher/src/core/sourcesLine.ts.
const SOURCE_LINE_MAX_ATTRIBUTIONS = 3

// Cloudflare-thumbnail query params shared between the bake-time fallback
// thumbnail and the renderer's entity-aware URL builder.
const THUMBNAIL_QUERY_BASE = "imType=thumbnail&imMinimal=1"

// Pull the slug off the trailing path segment. URLs may be absolute
// ("https://ourworldindata.org/economic-growth") or use a local base
// ("http://localhost:3030/grapher/foo") — both yield the same slug.
const slugFromUrl = (url: string): string | undefined => {
    try {
        const parsed = new URL(url)
        const parts = parsed.pathname.split("/").filter(Boolean)
        return parts[parts.length - 1]
    } catch {
        return undefined
    }
}

const buildCloudflareImageUrl = (
    filename: string | undefined,
    imageMetadataDictionary: Record<string, ImageMetadata>,
    width = 512
): string | undefined => {
    if (!filename) return undefined
    const cloudflareId = imageMetadataDictionary[filename]?.cloudflareId
    if (!cloudflareId) return undefined
    return `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=${width}`
}

const defaultThumbnail = `${BAKED_BASE_URL}/${DEFAULT_GDOC_FEATURED_IMAGE}`

// Pull a preview of the *actual content* (not the editor-supplied excerpt)
// by walking the body and concatenating paragraph-like text blocks until
// we have at least `maxChars` characters. Used as the primary preview
// string for article, topic-page, and data-insight cards so users see
// real prose rather than a short summary.
const extractBodyPreview = (
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface,
    maxChars: number = BODY_PREVIEW_TARGET_CHARS
): string | undefined => {
    const body = gdoc.content?.body
    if (!body) return undefined
    const paragraphs: string[] = []
    let total = 0
    for (const block of body) {
        traverseEnrichedBlock(block, (node) => {
            if (total >= maxChars) return
            if (node.type === "text" || node.type === "simple-text") {
                const spans = (node as { value?: unknown }).value
                if (Array.isArray(spans)) {
                    const text = spansToUnformattedPlainText(
                        spans as never
                    ).trim()
                    if (text.length > 0) {
                        paragraphs.push(text)
                        total += text.length
                    }
                }
            }
        })
        if (total >= maxChars) break
    }
    if (paragraphs.length === 0) return undefined
    return paragraphs.join(" ")
}

// Match how `baker/algolia/utils/pages.ts#getThumbnailUrl` resolves
// data-insight thumbnails: walk the body and grab the first inline image
// (preferring a smallFilename when one is set).
const findFirstImageBlock = (
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface
): EnrichedBlockImage | undefined => {
    const body = gdoc.content?.body
    if (!body) return undefined
    for (const block of body) {
        let found: EnrichedBlockImage | undefined
        traverseEnrichedBlock(block, (node) => {
            if (!found && node.type === "image") {
                found = node as EnrichedBlockImage
            }
        })
        if (found) return found
    }
    return undefined
}

// Strip ArchieML/markdown formatting from short prose strings (excerpts,
// subtitles) so they render cleanly in card UI. Conservative — keeps the
// inner text of links, drops emphasis markers, custom OWID components, and
// inline HTML.
const markdownToPlaintext = (input: string): string => {
    let text = stripCustomMarkdownComponents(input)
    // Headers: drop leading "#"s
    text = text.replace(/^#{1,6}\s+/gm, "")
    // Links: [label](url) -> label  (also handles #dod:, #ddod/source:, etc.)
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Bold / italic: **x**, __x__, *x*, _x_ -> x
    text = text.replace(/(\*\*|__)(.+?)\1/g, "$2")
    text = text.replace(/(\*|_)(.+?)\1/g, "$2")
    // Inline code: `x` -> x
    text = text.replace(/`([^`]+)`/g, "$1")
    // Strip any leftover HTML tags
    text = text.replace(/<[^>]+>/g, "")
    // Collapse whitespace
    text = text.replace(/\s+/g, " ").trim()
    return text
}

const fetchPublishedGdocsBySlugs = async (
    knex: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<Map<string, DbRawPostGdoc>> => {
    if (slugs.length === 0) return new Map()
    const rows = await db.knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
            SELECT *
            FROM posts_gdocs
            WHERE slug IN (?)
              AND published = 1
              AND publishedAt <= NOW()`,
        [slugs]
    )
    const bySlug = new Map<string, DbRawPostGdoc>()
    for (const row of rows) {
        if (row.slug) bySlug.set(row.slug, row)
    }
    return bySlug
}

interface ChartHitInfo {
    chartId: number
    subtitle?: string
    variantName?: string
    // Full source-line assembled across the chart's Y-axis variables —
    // mirrors what `chartInfo.source` carries in the FeaturedMetrics flow.
    // Built by `buildSourceLine`.
    source?: string
    availableTabs: string[]
}

// `JSON ->>` returns booleans as "true"/"false" strings, or null when the
// key is absent from the patched config.
const parseJsonBoolish = (raw: string | null, fallback: boolean): boolean => {
    if (raw === "true") return true
    if (raw === "false") return false
    return fallback
}

// Many older chart configs omit `chartTypes` entirely (the field defaults
// to ["LineChart"] in GrapherState). Without this fallback those charts'
// availableTabs would only ever contain "map" (when present), so they'd
// never satisfy the carousel's >1-tab threshold.
const parseChartTypes = (raw: string | null): string[] => {
    if (!raw) return ["LineChart"]
    try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed) || parsed.length === 0) return ["LineChart"]
        return parsed as string[]
    } catch {
        return ["LineChart"]
    }
}

// Carouselable tabs are the chart-type tabs (line/bar/scatter/...) and
// optionally the map tab. The table tab is excluded — it renders at a
// different aspect ratio and would jank the thumbnail strip. Returns the
// URL query-param values (e.g. "line", "map").
const buildAvailableTabs = (
    chartTypes: string[],
    hasMapTab: boolean
): string[] => {
    const tabs: string[] = []
    for (const t of chartTypes) {
        // chart_configs.full's `chartTypes` entries are GrapherTabName-style
        // strings (e.g. "LineChart", "DiscreteBar"); the mapping function
        // turns them into URL query-param strings ("line", "discrete-bar").
        const q = mapGrapherTabNameToQueryParam(t as GrapherTabName)
        if (q) tabs.push(q)
    }
    if (hasMapTab) tabs.push(GRAPHER_TAB_CONFIG_OPTIONS.map)
    // De-duplicate while preserving order.
    return [...new Set(tabs)]
}

// Pull the chart's DB id (= Algolia objectID for chart records), the
// patched subtitle, and the per-config chart-type / map-tab info needed to
// drive the indicator-row carousel for each grapher slug.
const fetchChartHitInfoBySlugs = async (
    knex: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<Map<string, ChartHitInfo>> => {
    if (slugs.length === 0) return new Map()
    // Aggregate the full source line across every Y-axis variable on the
    // chart, mirroring `buildSourcesLineFromColumns` in
    // packages/@ourworldindata/grapher/src/core/sourcesLine.ts (which is
    // what feeds SearchChartHitHeader.source in the FeaturedMetrics flow).
    // We prefer `variables.attribution` (full text) and fall back to
    // `attributionShort`, joined unique entries with "; " — caller caps
    // at 3 with "and other sources".
    const rows = await db.knexRaw<{
        slug: string
        chartId: number
        subtitle: string | null
        variantName: string | null
        // Driver may auto-parse JSON_ARRAYAGG; accept either shape.
        attributions: unknown
        chartTypes: string | null
        hasMapTab: string | null
    }>(
        knex,
        `-- sql
            SELECT cc.slug AS slug,
                   c.id AS chartId,
                   cc.full ->> '$.subtitle' AS subtitle,
                   cc.full ->> '$.variantName' AS variantName,
                   cc.full ->> '$.chartTypes' AS chartTypes,
                   cc.full ->> '$.hasMapTab' AS hasMapTab,
                   (
                       SELECT JSON_ARRAYAGG(
                           JSON_OBJECT(
                               'attribution', v.attribution,
                               'attributionShort', v.attributionShort
                           )
                       )
                       FROM chart_dimensions cd
                       JOIN variables v ON v.id = cd.variableId
                       WHERE cd.chartId = c.id AND cd.property = 'y'
                   ) AS attributions
            FROM chart_configs cc
            JOIN charts c ON c.configId = cc.id
            WHERE cc.slug IN (?)`,
        [slugs]
    )
    const bySlug = new Map<string, ChartHitInfo>()
    for (const row of rows) {
        if (row.slug && row.chartId != null) {
            bySlug.set(row.slug, {
                chartId: Number(row.chartId),
                subtitle: row.subtitle ?? undefined,
                variantName: row.variantName ?? undefined,
                source: buildSourceLine(row.attributions),
                availableTabs: buildAvailableTabs(
                    parseChartTypes(row.chartTypes),
                    parseJsonBoolish(row.hasMapTab, false)
                ),
            })
        }
    }
    return bySlug
}

interface AttributionRow {
    attribution: string | null
    attributionShort: string | null
}

// JSON_ARRAYAGG may come back from the mysql2 driver as either a JSON
// string or a pre-parsed array, depending on column-type detection. Handle
// both shapes defensively.
const parseAttributions = (raw: unknown): AttributionRow[] | undefined => {
    if (!raw) return undefined
    if (Array.isArray(raw)) return raw as AttributionRow[]
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw) as unknown
            if (Array.isArray(parsed)) return parsed as AttributionRow[]
        } catch {
            return undefined
        }
    }
    return undefined
}

const buildSourceLine = (raw: unknown): string | undefined => {
    const parsed = parseAttributions(raw)
    if (!parsed) return undefined
    const attributions = parsed
        .map((row) => {
            const full = row.attribution?.trim()
            if (full) return full
            return row.attributionShort?.trim() || ""
        })
        .filter(Boolean)
    const unique = [...new Set(attributions)]
    if (unique.length === 0) return undefined
    if (unique.length > SOURCE_LINE_MAX_ATTRIBUTIONS)
        return `${unique[0]} and other sources`
    return unique.join("; ")
}

// Data-insight bodies often reference a grapher chart (via the `grapher-url`
// content key) rather than a static image. The value can be either a plain
// URL or wrapped in <a href="…">…</a>. Pull the slug off the trailing path
// segment so we can build a chart-thumbnail URL from it.
const extractGrapherSlugFromDataInsight = (
    content: Record<string, unknown>
): string | undefined => {
    const raw = content["grapher-url"]
    if (typeof raw !== "string") return undefined
    const match = raw.match(/\/grapher\/([^/?"<>\s]+)/)
    return match?.[1]
}

const resolveGdocThumbnailUrl = (
    gdoc: DbEnrichedPostGdoc,
    type: RelatedItem["type"],
    imageMetadataDictionary: Record<string, ImageMetadata>
): string => {
    if (type === "data-insight") {
        // Match the algolia indexer's first-inline-image rule, but also fall
        // back to the chart preview for the linked grapher when present —
        // most data insights are chart-driven and don't ship an image block.
        const image = findFirstImageBlock(
            gdoc as unknown as OwidGdocDataInsightInterface
        )
        const filename = image?.smallFilename || image?.filename
        const inlineImageUrl = buildCloudflareImageUrl(
            filename,
            imageMetadataDictionary,
            608
        )
        if (inlineImageUrl) return inlineImageUrl

        const content = gdoc.content as unknown as Record<string, unknown>
        const grapherSlug = extractGrapherSlugFromDataInsight(content)
        if (grapherSlug) {
            return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${grapherSlug}.png`
        }
        return defaultThumbnail
    }

    const content = gdoc.content as unknown as Record<string, unknown>
    const featuredImage = content["featured-image"]
    const filename =
        typeof featuredImage === "string" ? featuredImage : undefined
    return (
        buildCloudflareImageUrl(filename, imageMetadataDictionary) ??
        defaultThumbnail
    )
}

const enrichGdocItem = (
    item: RelatedItem,
    slug: string,
    row: DbRawPostGdoc,
    imageMetadataDictionary: Record<string, ImageMetadata>
): EnrichedRelatedItem => {
    const enrichedRow = parsePostsGdocsRow(row)
    const content = enrichedRow.content as unknown as Record<string, unknown>

    const thumbnailUrl = resolveGdocThumbnailUrl(
        enrichedRow,
        item.type,
        imageMetadataDictionary
    )

    // Prefer body prose over the editor-supplied excerpt — readers told us
    // they want a preview of *actual* content, not the short editorial
    // summary. Fall back to the excerpt if the body yields nothing.
    const bodyPreview = extractBodyPreview(
        enrichedRow as unknown as OwidGdocDataInsightInterface
    )
    const rawExcerpt =
        typeof content.excerpt === "string" ? content.excerpt : undefined
    const excerptSource = bodyPreview ?? rawExcerpt
    const excerpt = excerptSource
        ? markdownToPlaintext(excerptSource)
        : undefined
    const authors = Array.isArray(content.authors)
        ? (content.authors as string[])
        : undefined
    const publishedAt = enrichedRow.publishedAt
        ? enrichedRow.publishedAt.toISOString()
        : undefined

    return {
        ...item,
        slug,
        thumbnailUrl,
        excerpt,
        authors,
        publishedAt,
    }
}

const enrichGrapherItem = (
    item: RelatedItem,
    slug: string,
    infoBySlug: Map<string, ChartHitInfo>
): EnrichedRelatedItem => {
    const info = infoBySlug.get(slug)
    const subtitle = info?.subtitle
        ? markdownToPlaintext(info.subtitle)
        : undefined
    return {
        ...item,
        slug,
        chartId: info?.chartId,
        subtitle,
        variantName: info?.variantName,
        source: info?.source,
        thumbnailUrl: `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.png?${THUMBNAIL_QUERY_BASE}`,
        availableTabs:
            info && info.availableTabs.length > 0
                ? info.availableTabs
                : undefined,
    }
}

export const enrichRelatedItems = async (
    knex: db.KnexReadonlyTransaction,
    items: RelatedItem[],
    imageMetadataDictionary: Record<string, ImageMetadata>
): Promise<EnrichedRelatedItem[]> => {
    if (items.length === 0) return []

    const resolved = items.map((item) => ({
        item,
        slug: slugFromUrl(item.url),
    }))

    const gdocSlugs: string[] = []
    const grapherSlugs: string[] = []
    for (const { item, slug } of resolved) {
        if (!slug) continue
        if (item.type === "grapher") grapherSlugs.push(slug)
        else gdocSlugs.push(slug)
    }

    const [gdocs, chartHitInfo] = await Promise.all([
        fetchPublishedGdocsBySlugs(knex, gdocSlugs),
        fetchChartHitInfoBySlugs(knex, grapherSlugs),
    ])

    return resolved.map(({ item, slug }): EnrichedRelatedItem => {
        if (!slug) return { ...item, slug: "" }

        if (item.type === "grapher") {
            return enrichGrapherItem(item, slug, chartHitInfo)
        }

        const row = gdocs.get(slug)
        if (!row) return { ...item, slug }
        return enrichGdocItem(item, slug, row, imageMetadataDictionary)
    })
}
