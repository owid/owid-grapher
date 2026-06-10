import * as React from "react"
import { DetailsMarker } from "@ourworldindata/types"
import {
    MarkdownTextWrap,
    IRDetailOnDemand,
    IRToken,
} from "./MarkdownTextWrap.js"

function MarkdownTextWrapLine({
    line,
}: {
    line: IRToken[]
}): React.ReactElement {
    return (
        <span className="markdown-text-wrap__line">
            {line.length ? line.map((token, i) => token.toHTML(i)) : <br />}
        </span>
    )
}

export function MarkdownTextWrapHtml({
    textWrap,
}: {
    textWrap: MarkdownTextWrap
}): React.ReactElement | null {
    const { htmlLines } = textWrap
    if (htmlLines.length === 0) return null
    return (
        <span style={textWrap.style} className="markdown-text-wrap">
            {htmlLines.map((line, i) => {
                const plaintextLine = line
                    .map((token) => token.toPlaintext())
                    .join("")
                return (
                    <MarkdownTextWrapLine
                        key={`${plaintextLine}-${i}`}
                        line={line}
                    />
                )
            })}
        </span>
    )
}

export function MarkdownTextWrapSvg({
    textWrap,
    x,
    y,
    detailsMarker = "superscript",
    id,
    ...svgTextProps
}: {
    textWrap: MarkdownTextWrap
    x: number
    y: number
    detailsMarker?: DetailsMarker
    id?: string
} & React.SVGProps<SVGTextElement>): React.ReactElement {
    const { fontSize, lineHeight } = textWrap
    const lines =
        detailsMarker === "superscript"
            ? textWrap.svgLinesWithDodReferenceNumbers
            : textWrap.svgLines
    if (lines.length === 0) return <></>

    const [, yOffset] = textWrap.getPositionForSvgRendering(x, y)

    const getLineY = (lineIndex: number) =>
        yOffset + lineHeight * fontSize * lineIndex

    return (
        <g id={id} className="markdown-text-wrap">
            <text
                x={x.toFixed(1)}
                y={yOffset.toFixed(1)}
                style={textWrap.style}
                {...svgTextProps}
            >
                {lines.map((line, lineIndex) => (
                    <tspan
                        key={lineIndex}
                        x={x}
                        y={getLineY(lineIndex).toFixed(1)}
                    >
                        {line.map((token, tokenIndex) =>
                            token.toSVG(tokenIndex)
                        )}
                    </tspan>
                ))}
            </text>
            {/* SVG doesn't support dotted underlines, so we draw them manually */}
            {detailsMarker === "underline" &&
                lines.map((line, lineIndex) => {
                    const lineY = (getLineY(lineIndex) + 2).toFixed(1)
                    let currWidth = 0
                    return line.map((token) => {
                        const underline =
                            token instanceof IRDetailOnDemand ? (
                                <line
                                    className="dod-underline"
                                    x1={x + currWidth}
                                    y1={lineY}
                                    x2={x + currWidth + token.width}
                                    y2={lineY}
                                    stroke="currentColor"
                                    strokeWidth={1}
                                    strokeDasharray={1}
                                    // important for rotated text
                                    transform={svgTextProps?.transform}
                                />
                            ) : null
                        currWidth += token.width
                        return underline
                    })
                })}
        </g>
    )
}
