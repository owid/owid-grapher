export interface SimulationConfig {
    hideControls: boolean
}

export interface PopulationConfig {
    hideControls: boolean
    title?: string
    subtitle?: string
}

export type DemographyConfig = SimulationConfig | PopulationConfig

export function parseConfig(
    variantName: string,
    raw: Record<string, string>
): DemographyConfig {
    switch (variantName) {
        case "population":
            return {
                hideControls: raw.hideControls === "true",
                title: raw.title,
                subtitle: raw.subtitle,
            }
        case "simulation":
        default:
            return {
                hideControls: raw.hideControls === "true",
            }
    }
}
