import {
    ANNOUNCEMENT_LATEST_TYPES,
    LATEST_PATH,
    LATEST_TYPE_LABELS,
    LATEST_TYPE_VALUES,
    LatestType,
    LatestUrlParam,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import { OwidGdocType, slugify } from "@ourworldindata/utils"

/** Build a URL to the /latest page, optionally pre-filtered by type. */
export function latestUrl(type?: LatestType): string {
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
 * Map an OwidGdocType (the gdoc's class discriminator) to the LatestType
 * used by /latest's facet pills (the user-facing category filter). The
 * mapping isn't 1:1: Article and DataInsight pass through, but a single
 * Announcement gdoc fans out across several LatestTypes ("data-update",
 * "website-upgrade", "announcement", …) — the bucket is picked from the
 * gdoc's human-authored `kicker`. Returns `undefined` for gdoc types
 * that aren't surfaced on /latest (topic pages etc.).
 *
 * Shared between the indexer (which writes latestType into the Algolia
 * record) and the standalone announcement preview (which derives the same
 * pill on render) so the two stay in sync.
 */
export function deriveLatestType(gdoc: {
    content: { type?: OwidGdocType; kicker?: string }
}): LatestType | undefined {
    switch (gdoc.content.type) {
        case OwidGdocType.Article:
        case OwidGdocType.DataInsight:
            return gdoc.content.type
        case OwidGdocType.Announcement: {
            // Tolerate kickers that don't match ANNOUNCEMENT_LATEST_TYPES
            // exactly — slugifying normalizes legacy pretty-form or
            // case-drifted kickers ("Data update", "Data Update",
            // "Announcement") so they still surface under the right
            // LatestType. The save-side validator
            // (GdocAnnouncement._validateSubclass) is stricter, so any
            // re-save ratchets the kicker to the canonical slug form.
            // Unrecognized kickers fall back to "announcement" and stay
            // visible on /latest until someone re-saves them.
            const slug = slugify(gdoc.content.kicker ?? "")
            if (
                (ANNOUNCEMENT_LATEST_TYPES as readonly string[]).includes(slug)
            ) {
                return slug as LatestType
            }
            return "announcement"
        }
        default:
            // topic-page, linear-topic-page: indexed for the atom feed but
            // hidden from /latest (absent latestType excludes them from
            // /latest's latestType-facet-based pills).
            return undefined
    }
}

/** Plural display label for a LatestType — used as the dropdown label on
 * /latest's "Filter by type" filter ("Articles", "Data Insights", …). */
export const latestTypeLabelPlural = (type: LatestType): string =>
    `${LATEST_TYPE_LABELS[type]}s`

/** Grid positioning applied to the root of every hit card. */
export const LATEST_HIT_GRID_CLASSES =
    "span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

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
        imageMetadata: hit.imageMetadata ?? {},
        linkedAuthors: hit.linkedAuthors ?? [],
        linkedCharts: hit.linkedCharts ?? {},
        linkedDocuments: hit.linkedDocuments ?? {},
        // Intentionally empty: card-level rendering doesn't reach into these,
        // and indexing them per record would inflate the Algolia payload
        // unnecessarily. If a future card type needs them, add them to
        // PageChronologicalRecord and to the indexer in pagesChronological.ts.
        linkedIndicators: {},
        relatedCharts: [],
        tags: [],
    }
}
