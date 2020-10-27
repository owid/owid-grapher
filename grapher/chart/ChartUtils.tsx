import { Box } from "grapher/core/GrapherConstants"
import { SelectionArray } from "grapher/core/SelectionArray"
import React from "react"
import { ChartManager } from "./ChartManager"

export const autoDetectYColumnSlugs = (manager: ChartManager) => {
    if (manager.yColumnSlugs && manager.yColumnSlugs.length)
        return manager.yColumnSlugs
    if (manager.yColumnSlug) return [manager.yColumnSlug]
    return manager.table.numericColumnSlugs
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
        : new SelectionArray(manager.selection)
