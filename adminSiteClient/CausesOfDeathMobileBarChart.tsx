import { useMemo } from "react"
import * as R from "remeda"
import {
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    DataRow,
} from "./CausesOfDeathConstants"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata"
import { formatPercentSigFig } from "./CausesOfDeathHelpers"
import useChartDimensions from "./useChartDimensions.js"
import { Bounds } from "@ourworldindata/utils"

interface CategoryBarData {
    category: string
    percentage: number
    color: string
    formattedPercentage: string
}

export function CausesOfDeathMobileBarChart({
    data,
    metadata,
}: {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
}) {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>()

    const categoryData = useMemo(() => {
        // Calculate total deaths
        const totalDeaths = R.sumBy(data, (row) => row.value)

        if (totalDeaths === 0) return []

        // Group data by category and sum values
        const categoryTotals = new Map<string, number>()

        for (const row of data) {
            const category = metadata.categoryNameByVariableName.get(
                row.variable
            )
            if (category) {
                const currentTotal = categoryTotals.get(category) || 0
                categoryTotals.set(category, currentTotal + row.value)
            }
        }

        // Convert to percentage ratios (0-1) and create bar data
        const barData: CategoryBarData[] = []
        for (const category of metadata.categories) {
            const total = categoryTotals.get(category.name) || 0
            const percentage = total / totalDeaths
            const formattedPercentage = formatPercentSigFig(percentage)

            barData.push({
                category: category.name,
                percentage,
                color: CAUSE_OF_DEATH_CATEGORY_COLORS[category.name] ?? "red",
                formattedPercentage,
            })
        }

        // Sort by percentage (descending)
        return R.sortBy(barData, (item) => -item.percentage)
    }, [data, metadata])

    return (
        <div
            ref={ref}
            className="causes-of-death-mobile-bar-chart"
            role="list"
            aria-label="Causes of death by category"
        >
            {categoryData.map((item, index) => {
                const offset = categoryData
                    .slice(0, index)
                    .reduce((acc, curr) => acc + curr.percentage * 100, 0)

                const fontSize = 12
                const padding = 4
                const availableWidth =
                    item.percentage * dimensions.width - padding - 0.5 * padding
                const percentageWidth = Bounds.forText(
                    item.formattedPercentage,
                    { fontSize: 12, fontWeight: 600 }
                ).width
                const percentageFits = percentageWidth <= availableWidth

                return (
                    <div
                        key={item.category}
                        className="causes-of-death-mobile-bar-chart__item"
                        role="listitem"
                        aria-label={`${item.category}: ${item.formattedPercentage} of deaths`}
                    >
                        <div
                            className="causes-of-death-mobile-bar-chart__bar-container"
                            tabIndex={0}
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(item.percentage * 100)}
                            aria-valuetext={item.formattedPercentage}
                        >
                            <div
                                className="causes-of-death-mobile-bar-chart__bar"
                                style={{
                                    backgroundColor: item.color,
                                    width: `${item.percentage * 100}%`,
                                    position: "relative",
                                    left: offset + "%",
                                }}
                            />
                        </div>
                        {percentageFits ? (
                            <span
                                className="causes-of-death-mobile-bar-chart__percentage"
                                style={{
                                    position: "absolute",
                                    top: "50%", // TODO
                                    transform: "translateY(-50%)",
                                    left: `calc(${offset}% + ${padding}px)`, // TODO
                                    fontSize,
                                }}
                            >
                                {item.formattedPercentage}
                            </span>
                        ) : (
                            <span
                                className="causes-of-death-mobile-bar-chart__percentage"
                                style={{
                                    position: "absolute",
                                    top: "50%", // TODO
                                    transform: "translate(-100%, -50%)",
                                    left: `calc(${offset}% - ${padding}px)`, // TODO
                                    color: "#5b5b5b",
                                    fontSize,
                                }}
                            >
                                {item.formattedPercentage}
                            </span>
                        )}
                        <span
                            className="causes-of-death-mobile-bar-chart__category"
                            style={{
                                position: "absolute",
                                top: "-20px",
                                left: "0",
                                color: "#5b5b5b",
                                // color: item.color,
                                fontSize,
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {item.category}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
