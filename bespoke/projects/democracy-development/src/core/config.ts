import {
    parseBoolean,
    parseEnum,
    parseInteger,
} from "../../../../helpers/config.js"
import { DEMOCRACY_AXES, type DemocracyAxis } from "./types.js"

export interface ScatterVariantConfig {
    title?: string
    subtitle?: string
    hideControls?: boolean
    /** Initial slider year */
    year?: number
    /** Start with continents coloured */
    colorByRegion?: boolean
    /** Start with dots sized by population */
    sizeByPopulation?: boolean
    /** Put the democracy index on the x or y axis (default: y) */
    democracyAxis?: DemocracyAxis
}

export function parseConfig(raw: Record<string, string>): ScatterVariantConfig {
    return {
        title: raw.title,
        subtitle: raw.subtitle,
        hideControls: parseBoolean(raw.hideControls),
        year: parseInteger(raw.year),
        colorByRegion: parseBoolean(raw.colorByRegion),
        sizeByPopulation: parseBoolean(raw.sizeByPopulation),
        democracyAxis: parseEnum(raw.democracyAxis, DEMOCRACY_AXES),
    }
}
