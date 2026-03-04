import React from "react"
import { SimpleVerticalLabelsState } from "./SimpleVerticalLabelsState"
import { darkenColorForText } from "../color/ColorUtils.js"
import { Halo } from "@ourworldindata/components"
import { GRAPHER_TEXT_OUTLINE_FACTOR } from "../core/GrapherConstants"

export function SimpleVerticalLabels({
    state,
}: {
    state: SimpleVerticalLabelsState
}): React.ReactElement {
    return (
        <g>
            {state.series.map((series) => (
                <Halo
                    id={series.seriesName}
                    key={series.seriesName}
                    outlineWidth={GRAPHER_TEXT_OUTLINE_FACTOR * state.fontSize}
                >
                    {series.textWrap.renderSVG(
                        series.textPosition.x,
                        series.textPosition.y,
                        {
                            textProps: {
                                textAnchor: state.textAnchor,
                                fill: darkenColorForText(series.color),
                            },
                        }
                    )}
                </Halo>
            ))}
        </g>
    )
}
