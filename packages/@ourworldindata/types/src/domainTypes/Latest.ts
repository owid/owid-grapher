/**
 * The flat content-category dimension used by /latest. For articles and
 * data insights this mirrors the gdoc type; for announcements it reflects
 * the (slugified) kicker. Absent for gdoc types that are indexed but not
 * shown on /latest (topic pages, linear topic pages).
 *
 * Ordered as displayed in the /latest "Filter by type" dropdown so callers
 * can iterate this tuple directly to render the dropdown.
 */
export const LATEST_TYPE_VALUES = [
    "data-insight",
    "article",
    "data-update",
    "website-upgrade",
    "announcement",
] as const
export type LatestType = (typeof LATEST_TYPE_VALUES)[number]

// Subset of LATEST_TYPE_VALUES that announcement gdocs can map to via their
// (slugified) kicker. Validated upstream in GdocAnnouncement._validateSubclass
// so unrecognized kickers can't reach a published announcement.
export const ANNOUNCEMENT_LATEST_TYPES = [
    "data-update",
    "website-upgrade",
    "announcement",
] as const satisfies readonly LatestType[]

/** Singular display labels for a LatestType. Iterate LATEST_TYPE_VALUES to
 * get the dropdown display order; append "s" for the plural form used as
 * the dropdown label. Used wherever a per-item kicker is rendered
 * (announcement page, homepage announcement card, /latest hit metadata). */
export const LATEST_TYPE_LABELS: Record<LatestType, string> = {
    "data-insight": "Data Insight",
    article: "Article",
    "data-update": "Data Update",
    "website-upgrade": "Website Upgrade",
    announcement: "Announcement",
}

export const LATEST_PATH = "/latest"

export enum LatestUrlParam {
    TOPICS = "topics",
    TYPE = "type",
}

export interface LatestState {
    topics: string[]
    latestType: LatestType | null
}

export const DEFAULT_LATEST_STATE: LatestState = {
    topics: [],
    latestType: null,
}
