import { MigrationView, Sex } from "./types.js"

export interface VariantProps<Config> {
    config: Config
}

export interface SankeyVariantConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    country?: string
    sex?: Sex
    year?: number
    flow?: MigrationView
    urlSync?: boolean
}

export function parseConfig(raw: Record<string, string>): SankeyVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
        country: raw.country,
        sex: parseSex(raw.sex),
        year: parseYear(raw.year),
        flow: parseMigrationFlow(raw.flow),
        urlSync: parseBoolean(raw.urlSync),
    }
}

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}

function parseSex(value: unknown): Sex | undefined {
    if (value === "both" || value === "female" || value === "male") return value
    return undefined
}

function parseYear(value: unknown): number | undefined {
    if (typeof value !== "string" && typeof value !== "number") return undefined
    const n = typeof value === "string" ? Number(value) : value
    return Number.isFinite(n) ? n : undefined
}

function parseMigrationFlow(value: unknown): MigrationView | undefined {
    if (value === "both" || value === "immigrants" || value === "emigrants")
        return value
    return undefined
}
