import React from "react"
import { makeFigmaId } from "@ourworldindata/utils"
import { AnchoredLabelsState } from "./AnchoredLabelsState"
import { darkenColorForText } from "../color/ColorUtils.js"
import { Emphasis } from "../interaction/Emphasis.js"
import { SeriesLabel } from "../seriesLabel/SeriesLabel.js"
import { ANCHORED_LABEL_STYLE } from "./AnchoredLabelsConstants.js"

export function AnchoredLabels({
    state,
}: {
    state: AnchoredLabelsState
}): React.ReactElement {
    return (
        <g>
            {state.series.map((series) => {
                const emphasis = series.emphasis ?? Emphasis.Default
                return (
                    <g
                        key={series.seriesName}
                        opacity={ANCHORED_LABEL_STYLE[emphasis].opacity}
                    >
                        <SeriesLabel
                            state={series.seriesLabel}
                            id={makeFigmaId("label", series.seriesName)}
                            x={series.textPosition.x}
                            y={
                                series.textPosition.y -
                                series.seriesLabel.height / 2
                            }
                            color={{ name: darkenColorForText(series.color) }}
                            outline
                        />
                    </g>
                )
            })}
        </g>
    )
}
