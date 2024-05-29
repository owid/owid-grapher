import React from "react"
import { Bounds } from "@ourworldindata/utils"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_FONT_SCALE_11_2,
} from "../core/GrapherConstants"

export function NoDataSection({
    entityNames,
    bounds,
    baseFontSize = 16,
}: {
    entityNames: string[]
    bounds: Bounds
    baseFontSize?: number
}): JSX.Element {
    {
        const displayedEntities = entityNames.slice(0, 5)
        const numRemainingEntities = Math.max(
            0,
            entityNames.length - displayedEntities.length
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
                    {displayedEntities.map((entityName) => (
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
                {numRemainingEntities > 0 && (
                    <div>
                        &{" "}
                        {numRemainingEntities === 1
                            ? "one"
                            : numRemainingEntities}{" "}
                        more
                    </div>
                )}
            </foreignObject>
        )
    }
}
