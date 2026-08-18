export interface CausesOfDeathConfig {
    region?: string
    sex?: string
    ageGroup?: string
    year?: number
    hideControls?: boolean
    urlSync?: boolean
}

export function parseConfig(raw: Record<string, string>): CausesOfDeathConfig {
    return {
        region: raw.region,
        sex: raw.sex,
        ageGroup: raw.ageGroup,
        year: parseYear(raw.year),
        hideControls: parseBoolean(raw.hideControls),
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
