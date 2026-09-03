import { parseBoolean, parseEnum } from "../../../../helpers/config.js"

export const FLOWS = ["both", "import", "export"] as const

export type Flow = (typeof FLOWS)[number]

export interface SankeyVariantConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    product?: string
    country?: string
    flow?: Flow
}

export function parseConfig(raw: Record<string, string>): SankeyVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
        product: raw.product,
        country: raw.country,
        flow: parseEnum(raw.flow, FLOWS),
    }
}
