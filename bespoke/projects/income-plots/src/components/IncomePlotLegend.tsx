import { useAtom, useAtomValue } from "jotai"
import {
    atomCombinedFactor,
    atomCurrentCurrency,
    atomHoveredEntity,
    atomLegendEntries,
    atomPovertyLineForLegend,
    atomRawDataForYear,
    atomTimeInterval,
} from "../store.ts"
import * as R from "remeda"
import cx from "classnames"
import { useMemo } from "react"
import {
    computePercentageBelowLine,
    formatCurrency,
    getTimeIntervalStr,
    roundPercentage,
} from "../utils/incomePlotUtils.ts"
import { WORLD_ENTITY_NAME } from "../utils/incomePlotConstants.ts"

export const IncomePlotLegend = ({
    isMobile = false,
}: {
    isMobile?: boolean
}) => {
    const entries = useAtomValue(atomLegendEntries)
    const [hoveredEntity, setHoveredEntity] = useAtom(atomHoveredEntity)
    const povertyLine = useAtomValue(atomPovertyLineForLegend)
    const currency = useAtomValue(atomCurrentCurrency)
    const combinedFactor = useAtomValue(atomCombinedFactor)
    const povertyLineFormatted =
        povertyLine !== null
            ? formatCurrency(povertyLine * combinedFactor, currency)
            : null
    const rawDataForYear = useAtomValue(atomRawDataForYear)
    const timeInterval = useAtomValue(atomTimeInterval)

    const percentageBelowLineMap = useMemo(() => {
        if (povertyLine === null) return null

        return computePercentageBelowLine(
            rawDataForYear,
            povertyLine,
            new Set(entries.map((e) => e.name))
        )
    }, [entries, povertyLine, rawDataForYear])

    const entriesSorted = useMemo(() => {
        if (!percentageBelowLineMap)
            return entries.filter((e) => e.name !== WORLD_ENTITY_NAME)

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
        <div
            className={cx("income-plot-legend", {
                "income-plot-legend--mobile": isMobile,
            })}
        >
            {percentageBelowLineMap && povertyLineFormatted && (
                <div className="legend-poverty-line-header">
                    Share of population that earns less than{" "}
                    {povertyLineFormatted} a {getTimeIntervalStr(timeInterval)}
                </div>
            )}
            <div className="legend-entries-container">
                {entriesSorted.map((entry) => {
                    const isHovered = entry.name === hoveredEntity
                    const percentageBelow = percentageBelowLineMap?.get(
                        entry.name
                    )

                    return (
                        <div
                            className={cx("legend-entry", {
                                "legend-entry--hovered": isHovered,
                                "legend-entry--has-percentages":
                                    percentageBelow !== undefined,
                                "--legend-entry--is-world":
                                    entry.name === WORLD_ENTITY_NAME,
                            })}
                            id={`legend-entry-${R.toKebabCase(entry.name)}`}
                            key={entry.name}
                            onMouseEnter={() => setHoveredEntity(entry.name)}
                            onMouseLeave={() => setHoveredEntity(null)}
                            style={
                                {
                                    "--legend-entry-color": entry.color,
                                    "--legend-entry-percentage-value":
                                        percentageBelow !== undefined
                                            ? R.round(percentageBelow, 1)
                                            : "",
                                } as React.CSSProperties
                            }
                        >
                            <div className="legend-entry-percentage-container">
                                {percentageBelow !== undefined && (
                                    <span className="legend-entry-percentage-label">
                                        {roundPercentage(percentageBelow)}%
                                    </span>
                                )}
                                <div className="legend-entry-swatch"></div>
                            </div>
                            <span className="legend-entry-label">
                                {entry.name}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
