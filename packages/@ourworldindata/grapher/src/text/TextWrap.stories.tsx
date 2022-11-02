import React from "react"

import { TextWrap } from "./TextWrap"

export default {
    title: "TextWrap",
}

const RED = "#f97272"
const GREEN = "#008400"

const HTMLAndSVG = ({
    text = "The quick brown fox jumped over the lazy dog.",
    fontSize = 16,
    maxWidth = 400,
    lineHeight = 1.1,
}: {
    text?: string
    fontSize?: number
    maxWidth?: number
    lineHeight?: number
}): JSX.Element => {
    const textwrap = new TextWrap({
        maxWidth,
        fontSize,
        lineHeight,
        text,
    })
    const width = maxWidth
    const height = textwrap.height
    return (
        <div>
            <div
                style={{
                    position: "absolute",
                    width: `${width}px`,
                    height: `${height}px`,
                    border: "1px dashed #ccc",
                }}
            ></div>
            <svg width={width} height={height} style={{ position: "absolute" }}>
                <g style={{ fill: RED, opacity: 0.75 }}>
                    {textwrap.render(0, 0)}
                </g>
            </svg>
            <div
                style={{
                    color: GREEN,
                    opacity: 0.75,
                    ...textwrap.htmlStyle,
                }}
            >
                {textwrap.renderHTML()}
            </div>
        </div>
    )
}

export const HTMLAndSVGComparison = (): JSX.Element => (
    <div>
        <HTMLAndSVG fontSize={12.4} maxWidth={120} lineHeight={1} />
        <br />
        <HTMLAndSVG fontSize={16} maxWidth={140} lineHeight={1} />
        <br />
        <HTMLAndSVG fontSize={20} maxWidth={200} lineHeight={1.2} />
        <br />
        <HTMLAndSVG fontSize={20} maxWidth={200} lineHeight={2} />
        <br />
        <HTMLAndSVG fontSize={40} maxWidth={400} lineHeight={1.5} />
    </div>
)
