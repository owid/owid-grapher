import React from "react"
import { AnchoredLabelsState } from "./AnchoredLabelsState"
import { darkenColorForText } from "../color/ColorUtils.js"
import { Halo, TextWrapSvg } from "@ourworldindata/components"

export function AnchoredLabels({
    state,
}: {
    state: AnchoredLabelsState
}): React.ReactElement {
    return (
        <g>
            {state.series.map((series) => (
                <Halo
                    id={series.seriesName}
                    key={series.seriesName}
                    fontSize={state.fontSize}
                >
                    <TextWrapSvg
                        textWrap={series.textWrap}
                        x={series.textPosition.x}
                        y={series.textPosition.y}
                        textAnchor={state.textAnchor}
                        fill={darkenColorForText(series.color)}
                    />
                </Halo>
            ))}
        </g>
    )
}
