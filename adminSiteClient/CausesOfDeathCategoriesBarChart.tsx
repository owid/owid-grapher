import { useMemo } from "react"
import * as d3 from "d3"
import { EntityName, Time } from "@ourworldindata/types"
import { DataRow, getCategoryColor } from "./CausesOfDeathConstants"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata"
import { useChartDimensions, DimensionsConfig } from "./useDimensions"
import { TextWrap, MarkdownTextWrap } from "@ourworldindata/components"
import { isDarkColor } from "@ourworldindata/grapher/src/color/ColorUtils"
import { formatShare } from "./CausesOfDeathHelpers"

interface CategoryData {
    category: string
    value: number
    percentage: number
    color: string
}

interface BarSegment extends CategoryData {
    x: number // Start position (0-100%)
    width: number // Segment width (0-100%)
}

interface LabelStrategy {
    type: "single-line" | "two-line" | "percentage-only"
    textWrap: TextWrap | MarkdownTextWrap
    fits: boolean
}

interface BarSegmentLabel {
    segment: BarSegment
    x: number
    y: number
    availableWidth: number
    availableHeight: number
    fontSize: number
    strategy: LabelStrategy
}

interface CausesOfDeathCategoriesBarChartProps {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
    entityName: EntityName
    year: Time
    width: number
    height?: number
    showLabels?: boolean
}

interface ResponsiveCausesOfDeathCategoriesBarChartProps {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
    entityName: EntityName
    year: Time
    dimensionsConfig?: DimensionsConfig
    height?: number
    showLabels?: boolean
}

function groupDataByCategories(
    data: DataRow[],
    metadata: CausesOfDeathMetadata
): CategoryData[] {
    // Group data by category and sum values
    const categoryTotals = new Map<string, number>()

    data.forEach((row) => {
        const categoryName = metadata.categoryNameByVariableName.get(
            row.variable
        )
        if (categoryName) {
            const category = categoryName as string
            const currentTotal = categoryTotals.get(category) || 0
            categoryTotals.set(category, currentTotal + row.value)
        }
    })

    // Calculate total deaths across all categories
    const totalDeaths = Array.from(categoryTotals.values()).reduce(
        (sum, value) => sum + value,
        0
    )

    // Convert to CategoryData array with percentages
    return Array.from(categoryTotals.entries()).map(([category, value]) => ({
        category,
        value,
        percentage: totalDeaths > 0 ? value / totalDeaths : 0,
        color: getCategoryColor(category),
    }))
}

function createBarSegments(categoryData: CategoryData[]): BarSegment[] {
    // Sort by value (largest first) for consistent visual ordering
    const sortedData = [...categoryData].sort((a, b) => b.value - a.value)

    // Create cumulative scale for positioning
    let cumulativePercentage = 0

    return sortedData.map((category) => {
        const segment: BarSegment = {
            ...category,
            x: cumulativePercentage,
            width: category.percentage,
        }
        cumulativePercentage += category.percentage
        return segment
    })
}

function determineLabelStrategy(
    segment: BarSegment,
    availableWidth: number,
    fontSize: number
): LabelStrategy {
    const formattedPercentage = formatShare(segment.percentage)
    const categoryName = segment.category

    // Strategy 1: Single line - "45.2% Noncommunicable diseases"
    // TODO: Add verticalAlign to MarkdownTextWrap
    const singleLineWrap = new MarkdownTextWrap({
        text: `**${formattedPercentage}** ${categoryName}`,
        fontSize,
        lineHeight: 1,
    })

    if (singleLineWrap.width <= availableWidth) {
        return {
            type: "single-line",
            textWrap: singleLineWrap,
            fits: true,
        }
    }

    // Strategy 3: Percentage only
    const percentageOnlyWrap = new TextWrap({
        text: formattedPercentage,
        maxWidth: Infinity,
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
    })

    return {
        type: "percentage-only",
        textWrap: percentageOnlyWrap,
        fits: percentageOnlyWrap.width <= availableWidth,
    }
}

function calculateSegmentLabels(
    segments: BarSegment[],
    barHeight: number,
    width: number,
    xScale: d3.ScaleLinear<number, number, never>
): BarSegmentLabel[] {
    // const horizontalPadding = 8 // 8
    // const verticalPadding = 0 // 4

    // Calculate adaptive padding based on rectangle dimensions
    const horizontalPaddingScale = d3
        .scaleSqrt()
        .domain([0, width]) // based on rectangle width
        .range([2, 9]) // horizontal padding range from 2px to 6px
        .clamp(true)

    return segments
        .map((segment) => {
            const segmentWidth = xScale(segment.width)
            const horizontalPadding = Math.round(
                horizontalPaddingScale(segmentWidth)
            )

            const availableWidth = Math.max(0, segmentWidth - horizontalPadding)
            const availableHeight = barHeight

            // Calculate font size based on segment width
            // const fontSize = Math.max(
            //     10,
            //     Math.min(16, segmentWidth / 8) // Responsive font size
            // )

            const fontSize = 13

            const x = xScale(segment.x) + horizontalPadding
            const y = barHeight / 2 // Center within the bar, accounting for the 5px top margin

            const strategy = determineLabelStrategy(
                segment,
                availableWidth,
                fontSize
            )

            return {
                segment,
                x,
                y,
                availableWidth,
                availableHeight,
                fontSize,
                strategy,
            }
        })
        .filter(
            (label): label is BarSegmentLabel =>
                label !== null && label.strategy.fits
        )
}

export function ResponsiveCausesOfDeathCategoriesBarChart({
    data,
    metadata,
    entityName,
    year,
    dimensionsConfig,
    height = 60,
}: ResponsiveCausesOfDeathCategoriesBarChartProps) {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({
        config: dimensionsConfig,
    })

    return (
        <div ref={ref}>
            <CausesOfDeathCategoriesBarChart
                data={data}
                metadata={metadata}
                entityName={entityName}
                year={year}
                width={dimensions.width}
                height={height}
            />
        </div>
    )
}

function CausesOfDeathCategoriesBarChart({
    data,
    metadata,
    entityName: _entityName,
    year: _year,
    width,
    height = 60,
}: CausesOfDeathCategoriesBarChartProps) {
    const barSegments = useMemo(() => {
        const categoryData = groupDataByCategories(data, metadata)
        return createBarSegments(categoryData)
    }, [data, metadata])

    // Create D3 scale for positioning
    const xScale = useMemo(
        () => d3.scaleLinear().domain([0, 1]).range([0, width]),
        [width]
    )

    const barHeight = height

    // Calculate labels if needed
    const segmentLabels = useMemo(() => {
        return calculateSegmentLabels(barSegments, barHeight, width, xScale)
    }, [barSegments, barHeight, width, xScale])

    return (
        <div className="causes-of-death-categories-bar-chart">
            <svg width={width} height={height}>
                <g>
                    {barSegments.map((segment) => (
                        <rect
                            key={segment.category}
                            x={xScale(segment.x)}
                            y={0}
                            width={xScale(segment.width)}
                            height={barHeight}
                            fill={segment.color}
                        />
                    ))}
                </g>
                <CausesOfDeathCategoriesBarLabels labels={segmentLabels} />
            </svg>
        </div>
    )
}

function CausesOfDeathCategoriesBarLabels({
    labels,
}: {
    labels: BarSegmentLabel[]
}) {
    return (
        <g>
            {labels.map((label) => {
                const textColor = isDarkColor(label.segment.color)
                    ? "white"
                    : "#333"

                if (
                    label.strategy.type === "single-line" ||
                    label.strategy.type === "percentage-only"
                ) {
                    // Use TextWrap for single line rendering
                    const textWrap = label.strategy.textWrap as TextWrap
                    return textWrap.renderSVG(label.x, label.y, {
                        textProps: {
                            fill: textColor,
                            dy: "-0.5em", // TODO
                        },
                    })
                } else {
                    return null
                }
            })}
        </g>
    )
}
