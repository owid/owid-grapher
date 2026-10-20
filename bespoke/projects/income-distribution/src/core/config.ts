import {
    parseBoolean,
    parseEnum,
    parseInteger,
    parseNumber,
} from "../../../../helpers/config.js"
import { TIME_INTERVALS, TimeInterval, VIEWS, View } from "./types.js"

export interface IncomeDistributionConfig {
    hideControls: boolean
    title?: string
    subtitle?: string
    /** Start on the global stack or on the selected countries */
    view?: View
    /**
     * Country names for the selected-countries view, comma-separated in the
     * ArchieML block; "userLocation" stands for the reader's own country
     */
    countries?: string[]
    year?: number
    /** A custom poverty line to start with, in international-$ per day */
    povertyLine?: number
    timeInterval?: TimeInterval
    /**
     * ISO 3166-1 alpha-3 code of the country whose currency to show incomes
     * in (e.g. DEU), or "userLocation" for the reader's own; defaults to
     * international dollars
     */
    currency?: string
}

export function parseConfig(
    raw: Record<string, string>
): IncomeDistributionConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        title: raw.title,
        subtitle: raw.subtitle,
        view: parseEnum(raw.view, VIEWS),
        countries: parseList(raw.countries),
        // An empty `year:` parses as 0, which no feed file exists for
        year: parsePositiveInteger(raw.year),
        povertyLine: parsePositiveNumber(raw.povertyLine),
        timeInterval: parseEnum(raw.timeInterval, TIME_INTERVALS),
        currency: raw.currency?.trim() || undefined,
    }
}

/** Comma-separated names; empty or missing stays undefined so the default applies */
function parseList(value: unknown): string[] | undefined {
    if (typeof value !== "string") return undefined
    const items = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    return items.length > 0 ? items : undefined
}

function parsePositiveNumber(value: unknown): number | undefined {
    const parsed = parseNumber(value)
    return parsed !== undefined && parsed > 0 ? parsed : undefined
}

function parsePositiveInteger(value: unknown): number | undefined {
    const parsed = parseInteger(value)
    return parsed !== undefined && parsed > 0 ? parsed : undefined
}
