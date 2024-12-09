import React from "react"
import { Bounds } from "@ourworldindata/utils"
import {
    GRAPHER_FONT_SCALE_11,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants"

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

        const headingFontsize = GRAPHER_FONT_SCALE_11 * baseFontSize
        const bodyFontsize = GRAPHER_FONT_SCALE_12 * baseFontSize

        return (
            <foreignObject
                className="NoDataSection"
                {...bounds.toProps()}
                style={{
                    textAlign: "right",
                    color: GRAPHER_LIGHT_TEXT,
                }}
            >
                <div className="heading" style={{ fontSize: headingFontsize }}>
                    No data
                </div>
                <div className="body" style={{ fontSize: bodyFontsize }}>
                    <ul>
                        {displayedNames.map((entityName) => (
                            <li key={entityName}>{entityName}</li>
                        ))}
                    </ul>
                    {remaining > 0 && (
                        <div>& {remaining === 1 ? "one" : remaining} more</div>
                    )}
                </div>
            </foreignObject>
        )
    }
}
