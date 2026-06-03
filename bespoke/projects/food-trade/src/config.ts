export interface VariantProps<Config> {
    config: Config
}

export type Flow = "both" | "import" | "export"

export interface SankeyVariantConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
    product?: string
    country?: string
    flow?: Flow
    urlSync?: boolean
}

export function parseConfig(raw: Record<string, string>): SankeyVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
        product: raw.product,
        country: raw.country,
        flow: parseFlow(raw.flow),
        urlSync: parseBoolean(raw.urlSync),
    }
}

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}

function parseFlow(value: unknown): Flow | undefined {
    if (value === "both" || value === "import" || value === "export")
        return value
    return undefined
}
