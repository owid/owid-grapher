import {
    ComparisonLineConfig,
    VerticalComparisonLineConfig,
} from "@ourworldindata/types"

export function isValidVerticalComparisonLineConfig(
    lineConfig: ComparisonLineConfig
): lineConfig is VerticalComparisonLineConfig {
    return "xEquals" in lineConfig && lineConfig.xEquals !== undefined
}
