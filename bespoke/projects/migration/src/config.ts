import {
    GENDER_ALL,
    GENDER_FEMALE,
    GENDER_MALE,
    GenderId,
    MigrationView,
} from "./types.js"

export interface VariantProps<Config> {
    config: Config
}

export interface SankeyVariantConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    country?: string
    genderId?: GenderId
    year?: number
    migrationFlow?: MigrationView
    urlSync?: boolean
}

export function parseConfig(raw: Record<string, string>): SankeyVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
        country: raw.country,
        genderId: parseGenderId(raw.genderId),
        year: parseYear(raw.year),
        migrationFlow: parseMigrationFlow(raw.migrationFlow),
        urlSync: parseBoolean(raw.urlSync),
    }
}

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}

function parseGenderId(value: unknown): GenderId | undefined {
    const n = typeof value === "string" ? Number(value) : value
    if (n === GENDER_ALL || n === GENDER_FEMALE || n === GENDER_MALE) return n
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
