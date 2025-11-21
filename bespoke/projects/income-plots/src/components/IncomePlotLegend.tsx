import { useAtom, useAtomValue } from "jotai"
import {
    atomCustomPovertyLine,
    atomHoveredEntity,
    atomLegendEntries,
    atomRawDataForYear,
} from "../store.ts"
import * as R from "remeda"
import cx from "classnames"
import { useMemo } from "react"
import { computePercentageBelowLine } from "../utils/incomePlotUtils.ts"

export const IncomePlotLegend = () => {
    const entries = useAtomValue(atomLegendEntries)
    const [hoveredEntity, setHoveredEntity] = useAtom(atomHoveredEntity)
    const povertyLine = useAtomValue(atomCustomPovertyLine)
    const rawDataForYear = useAtomValue(atomRawDataForYear)

    const percentageBelowLineMap = useMemo(() => {
        if (povertyLine === null) return null

        return computePercentageBelowLine(
            rawDataForYear,
            povertyLine,
            new Set(entries.map((e) => e.name))
        )
    }, [entries, povertyLine, rawDataForYear])

    const entriesSorted = useMemo(() => {
        if (!percentageBelowLineMap) return entries

        // Sort by the percentage below the poverty line, descending, so the bar chart looks nice
        return R.sortBy(entries, [
            (entry) => {
                const percentage = percentageBelowLineMap.get(entry.name)
                return percentage !== undefined ? percentage : Infinity
            },
            "desc",
        ])
    }, [entries, percentageBelowLineMap])

    return (
        <div className="income-plot-legend">
            {entriesSorted.map((entry) => {
                const isHovered = entry.name === hoveredEntity
                const percentageBelow = percentageBelowLineMap?.get(entry.name)

                return (
                    <div
                        className={cx("legend-entry", {
                            "legend-entry--hovered": isHovered,
                            "legend-entry--has-percentages":
                                percentageBelow !== undefined,
                        })}
                        id={`legend-entry-${R.toKebabCase(entry.name)}`}
                        key={entry.name}
                        onMouseEnter={() => setHoveredEntity(entry.name)}
                        onMouseLeave={() => setHoveredEntity(null)}
                        style={
                            {
                                "--legend-entry-color": entry.color,
                                "--legend-entry-percentage":
                                    percentageBelow !== undefined
                                        ? `${Math.round(percentageBelow)}px`
                                        : "",
                            } as React.CSSProperties
                        }
                    >
                        <div className="legend-entry-percentage-container">
                            {percentageBelow !== undefined && (
                                <span className="legend-entry-percentage-label">
                                    {Math.round(percentageBelow)}%
                                </span>
                            )}
                            <div className="legend-entry-swatch"></div>
                        </div>
                        <span className="legend-entry-label">{entry.name}</span>
                    </div>
                )
            })}
        </div>
    )
}
