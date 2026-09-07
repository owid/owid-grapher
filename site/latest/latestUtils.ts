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

/**
 * How cards render in a type-filtered feed that offers the View toggle:
 * "expanded" shows each card in full, read in place; "compact" shows the same
 * teaser card the unfiltered feed does, linking out to the page. Local UI
 * state, deliberately not in the URL.
 */
export const LATEST_FEED_VIEWS = ["expanded", "compact"] as const
export type LatestFeedView = (typeof LATEST_FEED_VIEWS)[number]
export const DEFAULT_LATEST_FEED_VIEW: LatestFeedView = "expanded"

/**
 * Types whose filtered feed offers the View toggle. Data insights only for
 * now; data updates are the obvious next candidate — add the type here and
 * make its hit component honour `view` (see LatestDataInsightHit).
 */
const LATEST_TYPES_WITH_VIEW_TOGGLE: readonly LatestType[] = ["data-insight"]

export function hasViewToggle(latestType: LatestType | null): boolean {
    return (
        latestType !== null &&
        LATEST_TYPES_WITH_VIEW_TOGGLE.includes(latestType)
    )
}

/**
 * Topic areas by popularity, most popular first. The order the /latest topic
 * pills render in, so the pills readers are most likely to want are the ones
 * visible without scrolling the pill row.
 *
 * Source: header-navigation clicks on each area's topics over the year to
 * September 2026 (the analytics database doesn't ingest the /latest filter
 * events themselves). Areas missing from this list sort last, in tag-graph
 * order, so a new area still shows up.
 */
export const LATEST_TOPIC_AREAS_BY_POPULARITY: readonly string[] = [
    "Health",
    "Population and Demographic Change",
    "Energy and Environment",
    "Poverty and Economic Development",
    "Food and Agriculture",
    "Education and Knowledge",
    "Human Rights and Democracy",
    "Violence and War",
    "Innovation and Technological Change",
    "Living Conditions, Community and Wellbeing",
]

export function sortTopicAreasByPopularity(areas: string[]): string[] {
    const rank = (area: string): number => {
        const i = LATEST_TOPIC_AREAS_BY_POPULARITY.indexOf(area)
        return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    // Array.prototype.sort is stable, so unranked areas keep their order.
    return [...areas].sort((a, b) => rank(a) - rank(b))
}

/** Grid positioning applied to the root of every hit card. */
export const LATEST_HIT_GRID_CLASSES =
    "span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

/** The newsletter block sits in the right-hand column beside the first
 * cards, and goes full-bleed once that column collapses. Shared by the live
 * UI and the baked skeleton so the two layouts can't drift apart. */
export const LATEST_NEWSLETTER_SIGNUP_CLASSES =
    "latest-page__newsletter-signup col-start-11 span-cols-3 col-lg-start-10 span-lg-cols-4 span-md-cols-14 col-md-start-1"

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
