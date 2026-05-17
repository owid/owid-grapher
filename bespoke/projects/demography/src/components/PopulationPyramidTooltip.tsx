import type { ReactElement } from "react"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { GrapherTooltipAnchor } from "@ourworldindata/utils"
import {
    formatPopulationShare,
    formatPopulationValueLong,
    parseAgeGroup,
    type PopulationPyramidAgeBucketsBySex,
} from "../helpers/utils.js"

// Match the offset used by the main population curve tooltip.
const TOOLTIP_OFFSET_X = 15
const TOOLTIP_OFFSET_Y = -10

export interface PopulationPyramidTooltipState {
    ageGroup: string
    position: { x: number; y: number }
}

interface PopulationPyramidTooltipProps {
    tooltipState: PopulationPyramidTooltipState | null
    ageBucketsBySex: PopulationPyramidAgeBucketsBySex
    totalPopulation: number
    width: number
    height: number
    maleColor: string
    femaleColor: string
    pinToBottom?: boolean
}

export function PopulationPyramidTooltip({
    tooltipState,
    ageBucketsBySex,
    totalPopulation,
    width,
    height,
    maleColor,
    femaleColor,
    pinToBottom = false,
}: PopulationPyramidTooltipProps): ReactElement | null {
    if (!tooltipState) return null

    const { ageGroup, position } = tooltipState
    const malePopulation = ageBucketsBySex.male[ageGroup] ?? 0
    const femalePopulation = ageBucketsBySex.female[ageGroup] ?? 0
    const malePopulationShare = getShareOfTotalPopulation(
        malePopulation,
        totalPopulation
    )
    const femalePopulationShare = getShareOfTotalPopulation(
        femalePopulation,
        totalPopulation
    )
    const labels = getSexLabels(ageGroup)

    return (
        <TooltipCard
            id="population-pyramid-tooltip"
            x={position.x}
            y={position.y}
            offsetX={TOOLTIP_OFFSET_X}
            offsetY={TOOLTIP_OFFSET_Y}
            title={`Ages ${formatAgeGroup(ageGroup)}`}
            anchor={pinToBottom ? GrapherTooltipAnchor.Bottom : undefined}
            containerBounds={pinToBottom ? undefined : { width, height }}
        >
            <TooltipValue
                label={labels.male}
                value={formatSexPopulationValue(
                    malePopulationShare,
                    malePopulation
                )}
                color={maleColor}
            />
            <TooltipValue
                label={labels.female}
                value={formatSexPopulationValue(
                    femalePopulationShare,
                    femalePopulation
                )}
                color={femaleColor}
            />
        </TooltipCard>
    )
}

function getShareOfTotalPopulation(
    population: number,
    totalPopulation: number
): number {
    return totalPopulation > 0 ? (population / totalPopulation) * 100 : 0
}

function formatSexPopulationValue(
    populationShare: number,
    population: number
): string {
    return `${formatPopulationShare(populationShare, 3)} · ${formatPopulationValueLong(population, 3)}`
}

function getSexLabels(ageGroup: string): { male: string; female: string } {
    const { startAge, endAge } = parseAgeGroup(ageGroup)

    if (endAge < 18) return { male: "Boys", female: "Girls" }
    if (startAge >= 18) return { male: "Men", female: "Women" }
    return { male: "Men and boys", female: "Women and girls" }
}

function formatAgeGroup(ageGroup: string): string {
    return ageGroup.replace("-", "–")
}
