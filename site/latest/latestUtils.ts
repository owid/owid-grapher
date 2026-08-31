import {
    LATEST_PATH,
    LATEST_TYPE_LABELS,
    LATEST_TYPE_VALUES,
    LatestFeedGdoc,
    LatestType,
    EnrichedBlockImage,
    LatestUrlParam,
    OwidEnrichedGdocBlock,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import {
    deriveAnnouncementLatestType,
    OwidGdocType,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"

/** Build the /latest page path, optionally pre-filtered by type. */
export function buildLatestPagePath(type?: LatestType): string {
    return type ? `${LATEST_PATH}?${LatestUrlParam.TYPE}=${type}` : LATEST_PATH
}

/** Decode the URL query `?type=` param back to a LatestType or null. */
export function decodeLatestType(param: string | null): LatestType | null {
    if (!param) return null
    return (LATEST_TYPE_VALUES as readonly string[]).includes(param)
        ? (param as LatestType)
        : null
}

/**
 * Map a /latest-eligible gdoc to its LatestType. Articles and Data Insights
 * pass through from `content.type`; Announcements bucket via kicker. Used by
 * the indexer; render-site call sites that already know they have an
 * announcement should call `deriveAnnouncementLatestType` directly.
 */
export function deriveLatestType(gdoc: LatestFeedGdoc): LatestType {
    return match<LatestFeedGdoc, LatestType>(gdoc)
        .with({ content: { type: OwidGdocType.Article } }, () => "article")
        .with(
            { content: { type: OwidGdocType.DataInsight } },
            () => "data-insight"
        )
        .with({ content: { type: OwidGdocType.Announcement } }, (g) =>
            deriveAnnouncementLatestType(g.content.kicker)
        )
        .exhaustive()
}

/** Plural display label for a LatestType — used as the dropdown label on
 * /latest's "Filter by type" filter ("Articles", "Data Insights", …). */
export const latestTypeLabelPlural = (type: LatestType): string =>
    `${LATEST_TYPE_LABELS[type]}s`

/**
 * Where a data update ultimately points the reader. Every data update ends
 * on a `cta` block (e.g. "Explore the updated data in our interactive chart")
 * which is what an expanded card links to.
 */
export function findCtaUrl(
    blocks: OwidEnrichedGdocBlock[]
): string | undefined {
    return blocks.findLast((block) => block.type === "cta")?.url
}

/**
 * The image a feed card shows beside its text: the first image block in the
 * body. Data insight and data update cards both lift it out of the body flow
 * and render it as the card thumbnail, so they filter it back out of the
 * blocks they pass to ArticleBlocks — keep the returned block identical (not
 * a copy) so callers can do that by identity.
 */
export function findThumbnailImageBlock(
    blocks: OwidEnrichedGdocBlock[]
): EnrichedBlockImage | undefined {
    return blocks.find((block) => block.type === "image")
}

/** Grid positioning applied to the root of every hit card. */
export const LATEST_HIT_GRID_CLASSES =
    "span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

/** Grid positioning for the facets row and the divider beneath it — shared
 * between the live UI (LatestSearch) and the baked skeleton
 * (LatestPageSkeleton) so the two layouts can't drift apart. */
export const LATEST_FACETS_CONTAINER_CLASSES =
    "latest-search__facets-container span-cols-12 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

export const LATEST_FILTERS_DIVIDER_CLASSES =
    "latest-search__filters-divider span-cols-12 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

/** Stable id for the announcement content heading, used by parent wrappers
 * (the feed's <article>) for aria-labelledby. */
export const announcementContentTitleId = (slug: string) =>
    `announcement-content-${slug}-title`

/**
 * Shape the hit record into the AttachmentsContext value expected by the
 * gdoc components that render inside each card (Image, ArticleBlocks, etc.).
 */
export function makeAttachments(hit: PageChronologicalRecord) {
    return {
        imageMetadata: "imageMetadata" in hit ? (hit.imageMetadata ?? {}) : {},
        linkedAuthors: "linkedAuthors" in hit ? (hit.linkedAuthors ?? []) : [],
        linkedCharts: "linkedCharts" in hit ? (hit.linkedCharts ?? {}) : {},
        linkedDocuments:
            "linkedDocuments" in hit ? (hit.linkedDocuments ?? {}) : {},
        // Intentionally empty: card-level rendering doesn't reach into these,
        // and indexing them per record would inflate the Algolia payload
        // unnecessarily. If a future card type needs them, add them to
        // PageChronologicalRecord and to the indexer in pagesChronological.ts.
        linkedIndicators: {},
        relatedCharts: [],
        tags: [],
    }
}
