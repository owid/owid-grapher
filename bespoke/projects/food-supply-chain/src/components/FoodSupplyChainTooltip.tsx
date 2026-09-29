import { Point } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import { formatMeasureValue } from "../core/format.js"
import { chooseStepColor } from "../core/waterfall.js"
import { PlacedStep } from "../core/waterfallLayout.js"

export interface FoodSupplyChainTooltipProps {
    step: PlacedStep
    isTotal: boolean
    isFirstStep: boolean
    shortUnit: string
    year: number
    numDecimalPlaces: number
    position: Point
    containerBounds?: { width: number; height: number }
    anchor?: GrapherTooltipAnchor
}

export function FoodSupplyChainTooltip({
    step,
    isTotal,
    isFirstStep,
    shortUnit,
    year,
    numDecimalPlaces,
    position,
    containerBounds,
    anchor,
}: FoodSupplyChainTooltipProps): React.ReactElement {
    const { name, delta, balanceAfter } = step.step
    const isFromZero = isTotal || isFirstStep

    return (
        <TooltipCard
            id="food-supply-chain-tooltip"
            x={position.x}
            y={position.y}
            offsetX={8}
            offsetY={8}
            title={name}
            subtitle={year}
            containerBounds={containerBounds}
            anchor={anchor}
        >
            <TooltipValue
                label={
                    isFromZero
                        ? "Per person per day"
                        : "Change per person per day"
                }
                value={formatMeasureValue(delta, {
                    numDecimalPlaces,
                    unit: shortUnit,
                    showPlus: !isFromZero && delta !== 0,
                })}
                color={chooseStepColor(step.step, isTotal)}
            />
            {!isFromZero && (
                <TooltipValue
                    label="Running total"
                    value={formatMeasureValue(balanceAfter, {
                        numDecimalPlaces,
                        unit: shortUnit,
                    })}
                />
            )}
        </TooltipCard>
    )
}
