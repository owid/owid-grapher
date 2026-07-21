import React from "react"
import { AnchoredLabelsState } from "./AnchoredLabelsState"
import { darkenColorForText } from "../color/ColorUtils.js"
import { Halo, TextWrapSvg } from "@ourworldindata/components"
import { Emphasis } from "../interaction/Emphasis.js"
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
                        <Halo id={series.seriesName} fontSize={state.fontSize}>
                            <TextWrapSvg
                                textWrap={series.textWrap}
                                x={series.textPosition.x}
                                y={series.textPosition.y}
                                textAnchor={state.textAnchor}
                                fill={darkenColorForText(series.color)}
                            />
                        </Halo>
                    </g>
                )
            })}
        </g>
    )
}
