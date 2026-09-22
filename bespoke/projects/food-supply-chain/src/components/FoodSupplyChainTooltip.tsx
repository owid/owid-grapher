import { Point } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import { COLORS } from "../core/constants.js"
import { formatMeasureValue } from "../core/format.js"
import { stageLabel } from "../core/stageLabels.js"
import { PlacedStep } from "../core/waterfallLayout.js"

export interface FoodSupplyChainTooltipProps {
    step: PlacedStep
    isTotal: boolean
    unit: string
    span: number
    position: Point
    containerBounds?: { width: number; height: number }
    anchor?: GrapherTooltipAnchor
}

export function FoodSupplyChainTooltip({
    step,
    isTotal,
    unit,
    span,
    position,
    containerBounds,
    anchor,
}: FoodSupplyChainTooltipProps): React.ReactElement {
    const { key, name, delta, balanceAfter } = step.step
    const color = isTotal
        ? COLORS.total
        : delta > 0
          ? COLORS.add
          : COLORS.subtract

    return (
        <TooltipCard
            id="food-supply-chain-tooltip"
            x={position.x}
            y={position.y}
            offsetX={8}
            offsetY={8}
            title={stageLabel(key, name)}
            containerBounds={containerBounds}
            anchor={anchor}
        >
            <TooltipValue
                value={formatMeasureValue(delta, {
                    span,
                    unit,
                    showPlus: !isTotal,
                })}
                color={color}
            />
            {!isTotal && (
                <TooltipValue
                    label="Running total"
                    value={formatMeasureValue(balanceAfter, { span, unit })}
                    color={color}
                />
            )}
        </TooltipCard>
    )
}
