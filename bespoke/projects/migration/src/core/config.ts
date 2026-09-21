import {
    parseBoolean,
    parseEnum,
    parseNumber,
} from "../../../../helpers/config.js"
import { MIGRATION_VIEWS, SEXES, MigrationView, Sex } from "./types.js"

export interface SankeyVariantConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    country?: string
    sex?: Sex
    year?: number
    flow?: MigrationView
}

export function parseConfig(raw: Record<string, string>): SankeyVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
        country: raw.country,
        sex: parseEnum(raw.sex, SEXES),
        year: parseNumber(raw.year),
        flow: parseEnum(raw.flow, MIGRATION_VIEWS),
    }
}
