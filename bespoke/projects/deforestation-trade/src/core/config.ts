import {
    parseBoolean,
    parseEnum,
    parseNumber,
} from "../../../../helpers/config.js"
import { PERIODS, Period, VIEWS, View } from "./types.js"

export interface DeforestationConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    country?: string
    year?: number
    /** Sum over the last 5 or 10 years of the data instead of one year */
    period?: Period
    flow?: View
}

export function parseConfig(raw: Record<string, string>): DeforestationConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
        country: raw.country,
        year: parseNumber(raw.year),
        period: parseEnum(raw.period, PERIODS),
        flow: parseEnum(raw.flow, VIEWS),
    }
}
