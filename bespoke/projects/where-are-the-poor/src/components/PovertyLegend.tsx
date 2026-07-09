import { useMemo } from "react"
import * as R from "remeda"
import {
    DataRow,
    formatGroupLabel,
    getGroupColor,
    GroupBy,
} from "../helpers/PovertyConstants.js"
import { getGroupForRow } from "../helpers/PovertyData.js"

export function PovertyLegend({
    data,
    groupBy,
}: {
    data: DataRow[]
    groupBy: GroupBy
}) {
    const groups = useMemo(() => {
        // Calculate the total number of poor people
        const numTotalPoor = R.sumBy(data, (row) => row.headcount)

        if (numTotalPoor === 0) return []

        // Group data by continent or World Bank region and sum values
        const grouped = R.pipe(
            data,
            R.groupBy((row) => getGroupForRow(row, groupBy)),
            R.mapValues((rows, group) => {
                const value = R.sumBy(rows, (row) => row.headcount)
                return {
                    name: group,
                    value,
                    share: value / numTotalPoor,
                    color: getGroupColor(group),
                }
            })
        )

        return R.pipe(
            Object.values(grouped),
            R.sortBy((item) => -item.share)
        )
    }, [data, groupBy])

    return (
        <div className="where-are-the-poor-legend">
            {groups.map((group) => (
                <div
                    key={group.name}
                    className="where-are-the-poor-legend__item"
                >
                    <div
                        className="where-are-the-poor-legend__swatch"
                        style={{ backgroundColor: group.color }}
                    />
                    <span className="where-are-the-poor-legend__label">
                        {formatGroupLabel(group.name)}
                    </span>
                </div>
            ))}
        </div>
    )
}
