import { useMemo } from "react"
import * as R from "remeda"
import {
    CAUSE_OF_DEATH_CATEGORIES,
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    DataRow,
} from "./CausesOfDeathConstants"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata"
import { formatPercentSigFig } from "./CausesOfDeathHelpers"

export function CausesOfDeathLegend({
    data,
    metadata,
}: {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
}) {
    const categoryPercentages = useMemo(() => {
        // Calculate total deaths
        const totalDeaths = R.sumBy(data, (row) => row.value)

        if (totalDeaths === 0) return new Map()

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

        // Convert to percentage ratios (0-1) for consistent formatting with treemap
        const percentageRatios = new Map<string, number>()
        for (const [category, total] of categoryTotals) {
            const ratio = total / totalDeaths
            percentageRatios.set(category, ratio)
        }

        return percentageRatios
    }, [data, metadata])

    const sortedCategories = useMemo(() => {
        return R.pipe(
            CAUSE_OF_DEATH_CATEGORIES,
            R.sortBy((category) => -(categoryPercentages.get(category) || 0)) // Negative for descending order
        )
    }, [categoryPercentages])

    return (
        <div className="causes-of-death-legend">
            {sortedCategories.map((category, index) => {
                const percentageRatio = categoryPercentages.get(category) || 0
                const formattedPercentage = formatPercentSigFig(percentageRatio)

                return (
                    <div
                        key={category}
                        className="causes-of-death-legend__item"
                    >
                        <div
                            className="causes-of-death-legend__color-box"
                            style={{
                                backgroundColor:
                                    CAUSE_OF_DEATH_CATEGORY_COLORS[category],
                            }}
                        />
                        <span className="causes-of-death-legend__label">
                            {index === 0 ? (
                                <>
                                    <b>{formattedPercentage}</b> died from{" "}
                                    {category.toLowerCase()}
                                </>
                            ) : (
                                <>
                                    <b>{formattedPercentage}</b> {category}
                                </>
                            )}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
