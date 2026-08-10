import * as _ from "lodash-es"
import * as React from "react"
import { DetailsMarker } from "@ourworldindata/types"
import {
    getDodUnderlineSegments,
    getLineFontSize,
    getLineGap,
    IRFragment,
    IRToken,
} from "./IRTokens.js"
import { AbstractTokenTextWrap } from "./AbstractTokenTextWrap.js"
import { omitUndefinedValues } from "@ourworldindata/utils"

function MarkdownTextWrapLine({
    line,
    style,
}: {
    line: IRToken[]
    style?: React.CSSProperties
}): React.ReactElement {
    return (
        <span
            className="markdown-text-wrap__line"
            style={omitUndefinedValues(style)}
        >
            {line.length ? line.map((token, i) => token.toHTML(i)) : <br />}
        </span>
    )
}

export function MarkdownTextWrapHtml({
    textWrap,
}: {
    textWrap: AbstractTokenTextWrap
}): React.ReactElement | null {
    const { htmlLines } = textWrap
    if (htmlLines.length === 0) return null
    return (
        <span style={textWrap.style} className="markdown-text-wrap">
            {htmlLines.map((line, i) => {
                const plaintextLine = line
                    .map((token) => token.toPlaintext())
                    .join("")

                const lineFontSize = getLineFontSize(line) ?? textWrap.fontSize
                const lineGap = getLineGap(line)

                const style = {
                    fontSize:
                        lineFontSize !== textWrap.fontSize
                            ? lineFontSize
                            : undefined,
                    marginTop: lineGap > 0 ? lineGap : undefined,
                }

                return (
                    <MarkdownTextWrapLine
                        key={`${plaintextLine}-${i}`}
                        line={line}
                        style={style}
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
    textWrap: AbstractTokenTextWrap
    x: number
    y: number
    detailsMarker?: DetailsMarker
    id?: string
} & React.SVGProps<SVGTextElement>): React.ReactElement {
    const lines =
        detailsMarker === "superscript"
            ? textWrap.svgLinesWithDodReferenceNumbers
            : textWrap.svgLines
    if (lines.length === 0) return <></>

    const [, yOffset] = textWrap.getPositionForSvgRendering(x, y)

    // The first line's baseline is given by yOffset; every subsequent line
    // advances the baseline by its own line height plus its line gap
    const lineHeights = lines.map(
        (line) => textWrap.getLineHeight(line) + getLineGap(line)
    )
    const getLineY = (lineIndex: number): number =>
        yOffset + _.sum(lineHeights.slice(1, lineIndex + 1))

    const textRuns = lines.flatMap((line, lineIndex) =>
        splitLineIntoTextRuns(line, x, getLineY(lineIndex))
    )

    return (
        <g id={id} className="markdown-text-wrap">
            {textRuns.map((run, runIndex) => (
                <text
                    key={runIndex}
                    x={run.x.toFixed(1)}
                    y={run.y.toFixed(1)}
                    style={
                        run.style
                            ? { ...textWrap.style, ...run.style }
                            : textWrap.style
                    }
                    {...svgTextProps}
                >
                    {run.tokens.map((token, tokenIndex) =>
                        token.toSVG(tokenIndex)
                    )}
                </text>
            ))}
            {/* SVG doesn't support dotted underlines, so we draw them manually */}
            {detailsMarker === "underline" &&
                lines.map((line, lineIndex) => {
                    const lineY = (getLineY(lineIndex) + 2).toFixed(1)
                    return getDodUnderlineSegments(line).map(
                        (segment, segmentIndex) => (
                            <line
                                key={`${lineIndex}-${segmentIndex}`}
                                className="dod-underline"
                                x1={x + segment.x}
                                y1={lineY}
                                x2={x + segment.x + segment.width}
                                y2={lineY}
                                stroke="currentColor"
                                strokeWidth={1}
                                strokeDasharray={1}
                                // important for rotated text
                                transform={svgTextProps?.transform}
                            />
                        )
                    )
                })}
        </g>
    )
}

interface SvgTextRun {
    tokens: IRToken[]
    x: number
    y: number
    /** Style overrides on top of the text wrap's own style */
    style?: React.CSSProperties
}

/**
 * Splits a line into the `<text>` elements it renders as. A line is one
 * element, except that fragments switching the font family get one of their
 * own: resvg — which rasterises chart PNGs at the edge — silently drops a
 * whole `<text>` element that mixes font families when the text contains
 * certain glyph pairs (`ti`, `tt`, `tf` and `ft` in Playfair Display).
 */
function splitLineIntoTextRuns(
    line: IRToken[],
    x: number,
    y: number
): SvgTextRun[] {
    const runs: SvgTextRun[] = []
    let currentRun: SvgTextRun | undefined
    let offset = 0
    for (const token of line) {
        if (token instanceof IRFragment && token.styleDelta.fontFamily) {
            runs.push({
                tokens: token.children,
                // A <text> element has no dx, so the fragment's inline gap
                // is folded into its x position
                x: x + offset + token.inlineGap,
                y,
                style: token.svgStyle,
            })
            currentRun = undefined
        } else {
            if (!currentRun) {
                currentRun = { tokens: [], x: x + offset, y }
                runs.push(currentRun)
            }
            currentRun.tokens.push(token)
        }
        offset += token.width
    }
    return runs
}
