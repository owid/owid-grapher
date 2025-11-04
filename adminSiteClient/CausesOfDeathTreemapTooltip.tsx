import { TooltipState } from "./CausesOfDeathConstants.js"
import { TooltipCore } from "@ourworldindata/grapher/src/tooltip/Tooltip"
import * as d3 from "d3"

export function CausesOfDeathTreemapTooltip({
    state,
    containerWidth,
    containerHeight,
    offsetX = 8,
    offsetY = 8,
}: {
    state: TooltipState
    containerWidth: number
    containerHeight: number
    offsetX?: number
    offsetY?: number
}) {
    const { target, position } = state

    if (!target) return null

    const node = target.node
    const variable = node.data.data.variable
    const value = node.value || 0
    const category = node.data.data.category

    return (
        <TooltipCore
            id="causes-of-death-tooltip"
            x={position.x}
            y={position.y}
            offsetX={offsetX}
            offsetY={offsetY}
            title={variable}
            subtitle={category}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
        >
            <div style={{ fontSize: "11px" }}>
                Deaths: {d3.format(",~")(value)}
            </div>
        </TooltipCore>
    )
}
