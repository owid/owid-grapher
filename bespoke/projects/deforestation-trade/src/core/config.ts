import {
    parseBoolean,
    parseEnum,
    parseNumber,
} from "../../../../helpers/config.js"
import { VIEWS, View } from "./types.js"

export interface DeforestationConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    country?: string
    year?: number
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
        flow: parseEnum(raw.flow, VIEWS),
    }
}
