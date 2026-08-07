import { ShowMode } from "./types.js"

export interface PyramidVariantConfig {
    hideControls?: boolean
    title?: string
    subtitle?: string
    /** Display name of the initial entity, or the "userLocation" sentinel */
    country?: string
    year?: number
    show?: ShowMode
    compare?: boolean
    urlSync?: boolean
}

export function parseConfig(raw: Record<string, string>): PyramidVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        title: raw.title,
        subtitle: raw.subtitle,
        country: raw.country,
        year: parseYear(raw.year),
        show: parseShowMode(raw.show),
        compare: parseBoolean(raw.compare),
        urlSync: parseBoolean(raw.urlSync),
    }
}

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}

function parseYear(value: unknown): number | undefined {
    if (typeof value !== "string" && typeof value !== "number") return undefined
    const n = typeof value === "string" ? Number(value) : value
    return Number.isFinite(n) ? n : undefined
}

function parseShowMode(value: unknown): ShowMode | undefined {
    if (value === "number" || value === "share") return value
    return undefined
}
