import { parseBoolean, parseNumber } from "../../../../helpers/config.js"

export interface CausesOfDeathConfig {
    region?: string
    sex?: string
    ageGroup?: string
    year?: number
    hideControls?: boolean
}

export function parseConfig(raw: Record<string, string>): CausesOfDeathConfig {
    return {
        region: raw.region,
        sex: raw.sex,
        ageGroup: raw.ageGroup,
        year: parseNumber(raw.year),
        hideControls: parseBoolean(raw.hideControls),
    }
}
