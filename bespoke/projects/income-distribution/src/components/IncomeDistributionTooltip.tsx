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
    roundIncomeAsDisplayed,
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
    /** The income under the cursor, which shares are computed against (the tooltip only shows while no poverty line is set) */
    line: number
    hoveredEntity: string | null
    yearData: IncomeDistributionYear
    year: number
    currency: Currency
    timeInterval: TimeInterval
    /** Colour of the entity's swatch in the chart, for the value */
    color?: string
    /**
     * Show only the click hint, with no entity or share. Used in the
     * compare-countries view over empty space, where a World figure
     * wouldn't match anything drawn.
     */
    hintOnly?: boolean
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
    color,
    hintOnly = false,
}: IncomeDistributionTooltipProps): React.ReactElement {
    const entity = hoveredEntity ?? WORLD_ENTITY_NAME

    // Against the amount the tooltip shows, not the exact pointer position
    const share = useMemo(
        () =>
            shareBelowLineForEntities(
                yearData,
                roundIncomeAsDisplayed(line, currency, timeInterval),
                [entity]
            ).get(entity),
        [yearData, line, currency, timeInterval, entity]
    )

    const verb = isTouchDevice() ? "Tap" : "Click"
    const cardProps = {
        id: "income-distribution-tooltip",
        x: position.x,
        y: position.y,
        offsetX: 12,
        offsetY: 12,
        footer: [
            {
                icon: TooltipFooterIcon.None,
                text: `${verb} to set a poverty line here`,
            },
        ],
        style: { maxWidth: 280 },
        containerBounds: isPinned ? undefined : containerBounds,
        anchor: isPinned ? GrapherTooltipAnchor.Bottom : undefined,
    }

    if (hintOnly) return <TooltipCard {...cardProps} />

    return (
        <TooltipCard {...cardProps} title={entity} subtitle={year}>
            <TooltipValue
                label={`Share of population living on less than ${formatIncome(line, currency, timeInterval)} a ${timeIntervalNoun(timeInterval)}`}
                value={share !== undefined ? formatShare(share) : undefined}
                color={color}
            />
        </TooltipCard>
    )
}
