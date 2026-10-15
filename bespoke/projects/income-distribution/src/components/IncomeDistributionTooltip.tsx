import { useMemo } from "react"

import { Bounds, isTouchDevice } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { TooltipFooterIcon } from "@ourworldindata/grapher/src/tooltip/TooltipProps.js"

import { shareBelowLineForEntities } from "../core/density.js"
import {
    formatIncome,
    formatShare,
    timeIntervalNoun,
} from "../core/currency.js"
import { WORLD_ENTITY_NAME } from "../core/constants.js"
import type {
    Currency,
    IncomeDistributionYear,
    TimeInterval,
} from "../core/types.js"

export interface IncomeDistributionTooltipProps {
    /** Relative to the chart container */
    position: { x: number; y: number }
    /** The chart container's size */
    containerBounds: Bounds
    /** Pinned to the bottom of the viewport on touch devices */
    isPinned: boolean
    /** The line shares are computed against: the custom poverty line if set, else the income under the cursor */
    line: number
    hoveredEntity: string | null
    yearData: IncomeDistributionYear
    year: number
    currency: Currency
    timeInterval: TimeInterval
    hasPovertyLine: boolean
    /** Colour of the entity's swatch in the chart, for the value */
    color?: string
}

export function IncomeDistributionTooltip({
    position,
    containerBounds,
    isPinned,
    line,
    hoveredEntity,
    yearData,
    year,
    currency,
    timeInterval,
    hasPovertyLine,
    color,
}: IncomeDistributionTooltipProps): React.ReactElement {
    const entity = hoveredEntity ?? WORLD_ENTITY_NAME

    const share = useMemo(
        () => shareBelowLineForEntities(yearData, line, [entity]).get(entity),
        [yearData, line, entity]
    )

    const verb = isTouchDevice() ? "Tap" : "Click"
    const hint = hasPovertyLine
        ? `${verb} to remove the poverty line`
        : `${verb} to set a poverty line here`

    return (
        <TooltipCard
            id="income-distribution-tooltip"
            x={position.x}
            y={position.y}
            offsetX={12}
            offsetY={12}
            title={entity}
            subtitle={year}
            footer={[{ icon: TooltipFooterIcon.None, text: hint }]}
            style={{ maxWidth: 280 }}
            containerBounds={isPinned ? undefined : containerBounds}
            anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
        >
            <TooltipValue
                label={`Share of population living on less than ${formatIncome(line, currency, timeInterval)} a ${timeIntervalNoun(timeInterval)}`}
                value={share !== undefined ? formatShare(share) : undefined}
                color={color}
            />
        </TooltipCard>
    )
}
