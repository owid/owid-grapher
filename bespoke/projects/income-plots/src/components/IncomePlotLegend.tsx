import { useAtomValue } from "jotai"
import { atomLegendEntries } from "../store.ts"
import * as R from "remeda"

export const IncomePlotLegend = () => {
    const entries = useAtomValue(atomLegendEntries)
    return (
        <div className="income-plot-legend">
            {entries.map((entry) => (
                <div
                    className="legend-entry"
                    id={`legend-entry-${R.toKebabCase(entry.name)}`}
                    key={entry.name}
                >
                    <div
                        className="legend-entry-swatch"
                        style={{
                            backgroundColor: entry.color,
                            // width: Math.random() * 100 + "px",
                        }}
                    ></div>
                    <span>{entry.name}</span>
                </div>
            ))}
        </div>
    )
}
