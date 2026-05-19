export interface VariantProps<Config> {
    config: Config
}

export type TradeFlow = "both" | "imports" | "exports"

export interface MainVariantConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    product?: string
    country?: string
    tradeFlow?: TradeFlow
}

export function parseConfig(raw: Record<string, string>): MainVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
        product: raw.product,
        country: raw.country,
        tradeFlow: parseTradeFlow(raw.tradeFlow),
    }
}

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}

function parseTradeFlow(value: unknown): TradeFlow | undefined {
    if (value === "both" || value === "imports" || value === "exports")
        return value
    return undefined
}
