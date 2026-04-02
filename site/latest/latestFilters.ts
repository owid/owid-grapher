import { OwidGdocType } from "@ourworldindata/types"

/**
 * A filter on the Latest page can be either a gdoc type (e.g. "article",
 * "data-insight") or an announcement kicker value (e.g. "Data updates",
 * "Website update"). Type-based filters go to Algolia's `type` facet;
 * kicker-based filters use `type:announcement AND kicker:"…"`.
 */
export type LatestFilter =
    | { kind: "type"; value: OwidGdocType }
    | { kind: "kicker"; value: string }

const TYPE_FILTER_OPTIONS: { filter: LatestFilter; label: string }[] = [
    {
        filter: { kind: "type", value: OwidGdocType.DataInsight },
        label: "Data Insights",
    },
    {
        filter: { kind: "type", value: OwidGdocType.Article },
        label: "Articles",
    },
]

const KICKER_FILTER_OPTIONS: { filter: LatestFilter; label: string }[] = [
    {
        filter: { kind: "kicker", value: "Data update" },
        label: "Data updates",
    },
    {
        filter: { kind: "kicker", value: "Website upgrade" },
        label: "Website upgrades",
    },
    {
        filter: { kind: "kicker", value: "Announcement" },
        label: "Announcements",
    },
]

export const ALL_FILTER_OPTIONS = [
    ...TYPE_FILTER_OPTIONS,
    ...KICKER_FILTER_OPTIONS,
]

export function filtersAreEqual(
    a: LatestFilter | null,
    b: LatestFilter | null
): boolean {
    if (a === null || b === null) return a === b
    return a.kind === b.kind && a.value === b.value
}

/** Encode a LatestFilter for the URL query string `type` param. */
export function encodeFilter(filter: LatestFilter): string {
    if (filter.kind === "type") return filter.value
    return `kicker:${filter.value}`
}

/** Decode a URL query string `type` param back to a LatestFilter or null. */
export function decodeFilter(param: string | null): LatestFilter | null {
    if (!param) return null
    if (param.startsWith("kicker:")) {
        const value = param.slice("kicker:".length)
        return value ? { kind: "kicker", value } : null
    }
    // Check if it's a valid gdoc type for the latest page
    const validTypes: string[] = [
        OwidGdocType.Article,
        OwidGdocType.DataInsight,
    ]
    if (validTypes.includes(param)) {
        return { kind: "type", value: param as OwidGdocType }
    }
    return null
}
