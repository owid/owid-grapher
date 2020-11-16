import { Box, SeriesStrategy } from "grapher/core/GrapherConstants"
import { SelectionArray } from "grapher/selection/SelectionArray"
import React from "react"
import { ChartManager } from "./ChartManager"

export const autoDetectYColumnSlugs = (manager: ChartManager) => {
    if (manager.yColumnSlugs && manager.yColumnSlugs.length)
        return manager.yColumnSlugs
    if (manager.yColumnSlug) return [manager.yColumnSlug]
    return manager.table.numericColumnSlugs
}

export const getDefaultFailMessage = (manager: ChartManager) => {
    if (manager.table.rootTable.isBlank) return `No table loaded yet.`
    const yColumnSlugs = autoDetectYColumnSlugs(manager)
    if (!yColumnSlugs.length) return "Missing Y axis column"
    const selection = makeSelectionArray(manager)
    if (!selection.hasSelection) return `No ${selection.entityType} selected`
    return ""
}

export const autoDetectSeriesStrategy = (manager: ChartManager) => {
    if (manager.seriesStrategy) return manager.seriesStrategy

    return autoDetectYColumnSlugs(manager).length > 1
        ? SeriesStrategy.column
        : SeriesStrategy.entity
}

export const makeClipPath = (renderUid: number, box: Box) => {
    const id = `boundsClip-${renderUid})`
    return {
        id: `url(#${id})`,
        element: (
            <defs>
                <clipPath id={id}>
                    <rect {...box}></rect>
                </clipPath>
            </defs>
        ),
    }
}

export const makeSelectionArray = (manager: ChartManager) =>
    manager.selection instanceof SelectionArray
        ? manager.selection
        : new SelectionArray(manager.selection ?? [])
