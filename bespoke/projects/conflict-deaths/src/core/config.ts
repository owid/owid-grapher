import { parseBoolean, parseInteger } from "../../../../helpers/config.js"

export interface ConflictDeathsConfig {
    /** One of the conflict type slugs, e.g. "all" or "one-sided" */
    conflictType?: string
    year?: number
    hideControls?: boolean
}

export function parseConfig(raw: Record<string, string>): ConflictDeathsConfig {
    return {
        conflictType: raw.conflictType,
        year: parseInteger(raw.year),
        hideControls: parseBoolean(raw.hideControls),
    }
}
