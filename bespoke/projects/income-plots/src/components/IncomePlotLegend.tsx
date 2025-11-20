import { useAtom, useAtomValue } from "jotai"
import { atomHoveredEntity, atomLegendEntries } from "../store.ts"
import * as R from "remeda"
import cx from "classnames"

export const IncomePlotLegend = () => {
    const entries = useAtomValue(atomLegendEntries)
    const [hoveredEntity, setHoveredEntity] = useAtom(atomHoveredEntity)

    return (
        <div className="income-plot-legend">
            {entries.map((entry) => {
                const isHovered = entry.name === hoveredEntity

                return (
                    <div
                        className={cx("legend-entry", {
                            "legend-entry--hovered": isHovered,
                        })}
                        id={`legend-entry-${R.toKebabCase(entry.name)}`}
                        key={entry.name}
                        onMouseEnter={() => setHoveredEntity(entry.name)}
                        onMouseLeave={() => setHoveredEntity(null)}
                        style={
                            {
                                "--legend-entry-color": entry.color,
                            } as React.CSSProperties
                        }
                    >
                        <div className="legend-entry-swatch"></div>
                        <span>{entry.name}</span>
                    </div>
                )
            })}
        </div>
    )
}
