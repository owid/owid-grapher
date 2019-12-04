import { ChartConfigProps } from "charts/ChartConfig"
import { ChartTypeType } from "charts/ChartType"

export const EXPLORABLE_CHART_TYPES: ChartTypeType[] = [
    "LineChart",
    "DiscreteBar"
]

// A centralized predicate to test whether a chart can be explorable.
// Used for validation on both server & client.
export function canBeExplorable(config: ChartConfigProps) {
    return (
        EXPLORABLE_CHART_TYPES.includes(config.type) &&
        config.dimensions.length === 1
    )
}

export function isExplorable(config: ChartConfigProps): boolean {
    return config.isExplorable && canBeExplorable(config)
}
