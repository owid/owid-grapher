import { format } from "d3-format"

import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import type { HoverState, IndicatorSpec, ScatterPoint } from "../core/types.js"

const formatDemocracy = format(".2f")
const formatPopulation = format(".3~s")

export function ScatterTooltip({
    hover,
    point,
    spec,
    year,
    color,
    showPopulation,
    isPinned,
    containerBounds,
}: {
    hover: HoverState
    point: ScatterPoint
    spec: IndicatorSpec
    year: number
    color: string
    showPopulation: boolean
    /** Touch devices: fixed to the bottom of the viewport instead of following a cursor */
    isPinned: boolean
    containerBounds: { width: number; height: number }
}): React.ReactElement {
    const indicatorIsOlder = point.indicator.year !== year
    return (
        <TooltipCard
            id="democracy-development-tooltip"
            x={hover.position.x}
            y={hover.position.y}
            offsetX={12}
            offsetY={12}
            title={point.entityName}
            subtitle={`${year}`}
            subtitleFormat="notice"
            style={{ maxWidth: 260 }}
            containerBounds={isPinned ? undefined : containerBounds}
            anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
        >
            <TooltipValue
                label="Liberal Democracy Index"
                value={formatDemocracy(point.democracy.value)}
                color={color}
            />
            <TooltipValue
                label={spec.title}
                value={spec.formatValue(point.indicator.value)}
                color={color}
                originalTime={
                    indicatorIsOlder ? `${point.indicator.year}` : undefined
                }
            />
            {showPopulation && point.population !== undefined && (
                <TooltipValue
                    label="Population"
                    value={formatPopulation(point.population).replace(
                        /G$/,
                        "B"
                    )}
                    color={color}
                />
            )}
        </TooltipCard>
    )
}
