import { parseBoolean } from "../../../../helpers/config.js"

export interface FoodSupplyChainConfig {
    title?: string
    subtitle?: string
    hideControls?: boolean
    country?: string
}

export function parseConfig(
    raw: Record<string, string>
): FoodSupplyChainConfig {
    return {
        title: raw.title,
        subtitle: raw.subtitle,
        hideControls: parseBoolean(raw.hideControls),
        country: raw.country,
    }
}
