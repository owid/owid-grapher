import type { ReactElement } from "react"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { GrapherTooltipAnchor } from "@ourworldindata/utils"
import {
    formatPopulationShare,
    formatPopulationValueLong,
    parseAgeGroup,
    type PopulationPyramidAgeBucketsBySex,
} from "../helpers/utils.js"

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
    const ageGroupPopulation = malePopulation + femalePopulation
    const populationShare =
        totalPopulation > 0 ? (ageGroupPopulation / totalPopulation) * 100 : 0
    const labels = getSexLabels(ageGroup)

    return (
        <TooltipCard
            id="population-pyramid-tooltip"
            x={position.x}
            y={position.y}
            offsetX={15}
            offsetY={-10}
            title={`Ages ${formatAgeGroup(ageGroup)}`}
            anchor={pinToBottom ? GrapherTooltipAnchor.Bottom : undefined}
            containerBounds={pinToBottom ? undefined : { width, height }}
        >
            <TooltipValue
                label="Share of population"
                value={formatPopulationShare(populationShare, 3)}
                color={GRAPHER_LIGHT_TEXT}
            />
            <TooltipValue
                label={labels.male}
                value={formatPopulationValueLong(malePopulation, 3)}
                color={maleColor}
            />
            <TooltipValue
                label={labels.female}
                value={formatPopulationValueLong(femalePopulation, 3)}
                color={femaleColor}
            />
        </TooltipCard>
    )
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
