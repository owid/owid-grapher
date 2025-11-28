import { IndicatorsAfterPreProcessing, View } from "@ourworldindata/types"

export function getAllVariableIds(
    views: View<IndicatorsAfterPreProcessing>[]
): Set<number> {
    const variableIds = new Set<number>()
    for (const view of views) {
        for (const yIndicator of view.indicators.y) {
            variableIds.add(yIndicator.id)
        }
        if (view.indicators.x) variableIds.add(view.indicators.x.id)
        if (view.indicators.size) variableIds.add(view.indicators.size.id)
        if (view.indicators.color) variableIds.add(view.indicators.color.id)
    }
    return variableIds
}
