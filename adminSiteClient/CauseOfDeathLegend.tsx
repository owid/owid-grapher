import { useMemo } from "react"
import * as R from "remeda"
import { DataRow, getCategoryColor } from "./CausesOfDeathConstants"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata"

export function CausesOfDeathLegend({
    data,
    metadata,
}: {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
}) {
    const categories = useMemo(() => {
        // Calculate total deaths
        const totalDeaths = R.sumBy(data, (row) => row.value)

        if (totalDeaths === 0) return []

        // Group data by category and sum values
        const grouped = R.pipe(
            data,
            R.groupBy((row) =>
                metadata.categoryNameByVariableName.get(row.variable)
            ),
            R.pickBy((rows) => rows.length > 0),
            R.mapValues((rows, category) => {
                const value = R.sumBy(rows, (row) => row.value)
                return {
                    name: category,
                    value,
                    share: value / totalDeaths,
                    color: getCategoryColor(category),
                }
            })
        )

        return R.pipe(
            Object.values(grouped),
            R.sortBy((item) => -item.share)
        )
    }, [data, metadata])

    return (
        <div className="causes-of-death-legend">
            {categories.map((category) => (
                <div
                    key={category.name}
                    className="causes-of-death-legend__item"
                >
                    <div
                        className="causes-of-death-legend__swatch"
                        style={{ backgroundColor: category.color }}
                    />
                    <span className="causes-of-death-legend__label">
                        {category.name}
                    </span>
                </div>
            ))}
        </div>
    )
}
