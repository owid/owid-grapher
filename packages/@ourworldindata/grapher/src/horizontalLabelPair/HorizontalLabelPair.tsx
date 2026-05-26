import React from "react"
import { TextWrapSvg } from "@ourworldindata/components"
import { makeFigmaId } from "@ourworldindata/utils"
import { HorizontalLabelPairState } from "./HorizontalLabelPairState.js"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants.js"

export function HorizontalLabelPair({
    state,
    y,
    color = GRAPHER_DARK_TEXT,
}: {
    state: HorizontalLabelPairState
    y: number
    color?: string
}): React.ReactElement {
    return (
        <g id={makeFigmaId("horizontal-label-pair")}>
            {state.placedSeries.map((series, i) => (
                <TextWrapSvg
                    key={`${series}-${i}`}
                    textWrap={series.textWrap}
                    x={series.bounds.left}
                    y={y}
                    fill={series.color ?? color}
                />
            ))}
        </g>
    )
}
