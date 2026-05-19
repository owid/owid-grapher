import { OwidOrigin } from "../OwidOrigin.js"
import { OwidSource } from "../OwidSource.js"
import {
    IndicatorTitleWithFragments,
    OwidProcessingLevel,
} from "../OwidVariable.js"
import { RelatedChart } from "../grapherTypes/GrapherTypes.js"
import { OwidEnrichedGdocBlock } from "./ArchieMlComponents.js"
import { ImageMetadata } from "./Image.js"
import { ArchiveContext } from "../domainTypes/Archive.js"

export interface FaqLink {
    gdocId: string
    fragmentId: string
}

export interface PrimaryTopic {
    topicTag: string
    citation: string
}

export interface DataPageDataV2 {
    status: "published" | "draft"
    title: IndicatorTitleWithFragments
    titleVariant?: string
    attributionShort?: string
    topicTagsLinks?: string[]
    primaryTopic?: PrimaryTopic
    attributions: string[]
    description?: string
    descriptionShort?: string
    descriptionFromProducer?: string
    descriptionKey: string[]
    descriptionProcessing?: string
    owidProcessingLevel?: OwidProcessingLevel
    dateRange: string
    lastUpdated: string
    nextUpdate?: string
    relatedResearch: DataPageRelatedResearch[]
    relatedContent: RelatedItem[]
    enrichedRelatedContent?: EnrichedRelatedItem[]
    allCharts: RelatedChart[] // Chart slugs
    source: OwidSource | undefined
    origins: OwidOrigin[]
    chartConfig: Record<string, unknown>
    unit?: string
    unitConversionFactor?: number
}

export interface DataPageRelatedResearch {
    title: string
    url: string
    authors: string[]
    imageUrl: string
    tags: string[]
}

export type RelatedContentType =
    | "article"
    | "topic-page"
    | "data-insight"
    | "grapher"

export interface RelatedItem {
    url: string
    title: string
    type: RelatedContentType
    // True when this item is editorially pinned by the override file
    // (`site/relatedContentOverrides.json`). The renderer groups pinned
    // items into a separate "Our picks" subsection.
    isPinned?: boolean
}

// Enriched at bake time from posts_gdocs and chart configs so the data page
// can SSR rich related-content rows (thumbnails, excerpts, authors, dates,
// chart subtitles) without dragging in Algolia at runtime. Grapher rows
// upgrade to full multi-tab previews via SearchChartHitComponent once the
// Algolia hit lands on the client (keyed by `chartId`, which is the
// Algolia objectID).
export interface EnrichedRelatedItem extends RelatedItem {
    slug: string
    chartId?: number // graphers; matches the Algolia chart-hit objectID
    thumbnailUrl?: string
    excerpt?: string
    authors?: string[]
    publishedAt?: string // ISO date string
    subtitle?: string // graphers
    // Title qualifier shown under the indicator title (e.g. "World Bank,
    // constant international-$"). Pulled from chart_configs.full.
    variantName?: string // graphers
    // Short source attribution (e.g. "World Bank"). Pulled from the chart's
    // primary Y-axis variable's `attributionShort` at bake time — same
    // string the FeaturedMetrics chart hit shows as "Source: …".
    source?: string // graphers
    // Carouselable tabs (URL query-param values, e.g. "line", "map",
    // "discrete-bar") for grapher items. Powers the small carousel on the
    // indicator card's thumbnail. Excludes the table tab since it renders
    // at a different aspect ratio.
    availableTabs?: string[] // graphers
}

// TODO: https://github.com/owid/owid-grapher/issues/3426
export type FaqEntryData = {
    faqs: OwidEnrichedGdocBlock[]
}

export interface DataPageV2ContentFields {
    datapageData: DataPageDataV2
    /**
     * Per-indicator metadata for non-primary Y-indicators. Populated for charts
     * in FORCE_DATAPAGE_SLUGS that have multiple Y-indicators; left undefined
     * for ordinary single-indicator data pages. The metadata onion renders an
     * indicator switcher over `[primary, ...additionalIndicators]` when this is
     * non-empty.
     */
    additionalIndicators?: AdditionalIndicator[]
    faqEntries: FaqEntryData | undefined
    // TODO: add gdocs for FAQs
    isPreviewing?: boolean
    canonicalUrl: string
    tagToSlugMap: Record<string, string>
    imageMetadata: Record<string, ImageMetadata>
    archiveContext?: ArchiveContext
}

export interface AdditionalIndicator {
    datapageData: DataPageDataV2
    faqEntries?: FaqEntryData
}

export interface DisplaySource {
    label: string
    description?: string
    dataPublishedBy?: string
    retrievedOn?: string
    retrievedFrom?: string
    citation?: string
}
