import {
    parseBoolean,
    parseEnum,
    parseInteger,
} from "../../../../helpers/config.js"
import { INDEX_KEYS, IndexKey } from "./types.js"

export interface ScatterVariantConfig {
    /** Democracy index on the x axis */
    index?: IndexKey
    /** Year shown at first; the latest well-covered year when unset */
    year?: number
    /** Countries selected (labeled) at first, as a comma-separated list of names */
    countries: string[]
    sizeByPopulation: boolean
    showSmallCountries: boolean
    /**
     * Scale the whole frame down to the window's height, so title to footer are always visible
     * without scrolling -- for a page whose subject is this chart (a featured viz page, a
     * presentation), not for a figure inside an article.
     */
    fitToScreen: boolean
    hideControls: boolean
    title?: string
    subtitle?: string
}

export function parseConfig(raw: Record<string, string>): ScatterVariantConfig {
    return {
        index: parseEnum(raw.index, INDEX_KEYS),
        year: parseInteger(raw.year),
        countries: parseList(raw.countries),
        sizeByPopulation: parseBoolean(raw.sizeByPopulation),
        showSmallCountries: parseBoolean(raw.showSmallCountries),
        fitToScreen: parseBoolean(raw.fitToScreen),
        hideControls: parseBoolean(raw.hideControls),
        title: raw.title,
        subtitle: raw.subtitle,
    }
}

function parseList(value: unknown): string[] {
    if (typeof value !== "string") return []
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
}
