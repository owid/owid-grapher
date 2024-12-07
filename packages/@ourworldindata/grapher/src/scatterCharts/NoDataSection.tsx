import React from "react"
import { Bounds } from "@ourworldindata/utils"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_FONT_SCALE_11_2,
} from "../core/GrapherConstants"

export function NoDataSection({
    seriesNames,
    bounds,
    baseFontSize = 16,
}: {
    seriesNames: string[]
    bounds: Bounds
    baseFontSize?: number
}): React.ReactElement {
    {
        const displayedNames = seriesNames.slice(0, 5)
        const remaining = Math.max(
            0,
            seriesNames.length - displayedNames.length
        )

        return (
            <foreignObject
                {...bounds.toProps()}
                style={{
                    color: GRAPHER_DARK_TEXT,
                    fontSize: GRAPHER_FONT_SCALE_11_2 * baseFontSize,
                }}
            >
                <div
                    style={{
                        textTransform: "uppercase",
                        fontWeight: 700,
                        marginBottom: 2,
                        lineHeight: 1.15,
                    }}
                >
                    No data
                </div>
                <ul>
                    {displayedNames.map((entityName) => (
                        <li
                            key={entityName}
                            style={{
                                fontStyle: "italic",
                                lineHeight: 1.15,
                                marginBottom: 2,
                            }}
                        >
                            {entityName}
                        </li>
                    ))}
                </ul>
                {remaining > 0 && (
                    <div>& {remaining === 1 ? "one" : remaining} more</div>
                )}
            </foreignObject>
        )
    }
}
