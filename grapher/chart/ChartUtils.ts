import { ChartManager } from "./ChartManager"

export const autoDetectYColumnSlugs = (manager: ChartManager) => {
    if (manager.yColumnSlugs && manager.yColumnSlugs.length)
        return manager.yColumnSlugs
    if (manager.yColumnSlug) return [manager.yColumnSlug]
    return manager.table.numericColumnSlugs
}
