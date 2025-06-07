import {
    IndicatorsAfterPreProcessing,
    MultiDimDimensionChoices,
    View,
} from "@ourworldindata/types"
import { slugify } from "./Util.js"

export function multiDimDimensionsToViewId(
    dimensions: MultiDimDimensionChoices
): string {
    return Object.entries(dimensions)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([_, value]) => slugify(value))
        .join("__")
        .toLowerCase()
}

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
