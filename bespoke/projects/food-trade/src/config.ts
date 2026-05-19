export interface VariantProps<Config> {
    config: Config
}

export interface MainVariantConfig {
    hideControls?: boolean
    hideFlowSwitcher?: boolean
    title?: string
    subtitle?: string
}

export function parseConfig(raw: Record<string, string>): MainVariantConfig {
    return {
        hideControls: parseBoolean(raw.hideControls),
        hideFlowSwitcher: parseBoolean(raw.hideFlowSwitcher),
        title: raw.title,
        subtitle: raw.subtitle,
    }
}

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}
