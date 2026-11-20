import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import { formatMeasureValue, formatStepDelta } from "../core/text.js"
import { StepHover } from "../core/useStepHover.js"
import { chooseStepColor, Waterfall } from "../core/waterfall.js"
import { WaterfallLayout } from "../core/waterfallLayout.js"

export interface FoodSupplyChainTooltipProps {
    waterfall: Waterfall
    layout: WaterfallLayout
    hover: StepHover
    isPinned: boolean
    width: number
    height: number
}

export function FoodSupplyChainTooltip({
    waterfall,
    layout,
    hover,
    isPinned,
    width,
    height,
}: FoodSupplyChainTooltipProps): React.ReactElement | null {
    const placed = [...layout.steps, layout.total].find(
        (step) => step.step.key === hover.stepKey
    )
    if (!placed) return null

    const { name, delta, balanceAfter } = placed.step
    const isTotal = hover.stepKey === waterfall.total.key
    const isFromZero = isTotal || hover.stepKey === waterfall.steps[0]?.key

    return (
        <TooltipCard
            id="food-supply-chain-tooltip"
            x={hover.position.x}
            y={hover.position.y}
            offsetX={8}
            offsetY={8}
            title={name}
            subtitle={waterfall.year}
            containerBounds={isPinned ? undefined : { width, height }}
            anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
        >
            <TooltipValue
                label={
                    isFromZero
                        ? "Per person per day"
                        : "Change per person per day"
                }
                value={formatStepDelta(delta, waterfall.measure, {
                    isFromZero,
                })}
                color={chooseStepColor(placed.step, isTotal)}
            />
            {!isFromZero && (
                <TooltipValue
                    label="Running total"
                    value={formatMeasureValue(balanceAfter, waterfall.measure)}
                />
            )}
        </TooltipCard>
    )
}
