import {
    parseBoolean,
    parseEnum,
    parseNumber,
} from "../../../../helpers/config.js"
import { SHOW_MODES, ShowMode } from "./types.js"

export interface PyramidVariantConfig {
    hideControls: boolean
    title?: string
    subtitle?: string
    /** Display name of the initial entity, or the "userLocation" sentinel */
    country?: string
    year?: number
    show?: ShowMode
    compare: boolean
}

export function parseConfig(raw: Record<string, string>): PyramidVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        title: raw.title,
        subtitle: raw.subtitle,
        country: raw.country,
        year: parseNumber(raw.year),
        show: parseEnum(raw.show, SHOW_MODES),
        compare: parseBoolean(raw.compare),
    }
}
