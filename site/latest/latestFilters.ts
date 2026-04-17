import { LATEST_TYPE_VALUES, LatestType } from "@ourworldindata/types"

/** Options shown in the "Filter by type" dropdown on /latest, in display order. */
export const LATEST_TYPE_OPTIONS: { value: LatestType; label: string }[] = [
    { value: "data-insight", label: "Data Insights" },
    { value: "article", label: "Articles" },
    { value: "data-update", label: "Data updates" },
    { value: "website-upgrade", label: "Website upgrades" },
    { value: "announcement", label: "Announcements" },
]

/** Decode the URL query `?type=` param back to a LatestType or null. */
export function decodeLatestType(param: string | null): LatestType | null {
    if (!param) return null
    return (LATEST_TYPE_VALUES as readonly string[]).includes(param)
        ? (param as LatestType)
        : null
}
