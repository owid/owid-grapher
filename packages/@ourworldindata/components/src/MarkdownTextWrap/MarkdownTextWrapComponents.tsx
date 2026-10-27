import * as _ from "lodash-es"
import * as React from "react"
import { DetailsMarker } from "@ourworldindata/types"
import {
    getDodUnderlineSegments,
    getLineFontSize,
    getLineGap,
    IRToken,
} from "./IRTokens.js"
import { AbstractTokenTextWrap } from "./AbstractTokenTextWrap.js"
import { omitUndefinedValues, roundForSvg } from "@ourworldindata/utils"

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

    // Set the font family as an attribute rather than in `style`: otherwise they'll
    // break the Figma import
    const { fontFamily, ...style } = textWrap.style

    // The first line's baseline is given by yOffset; every subsequent line
    // advances the baseline by its own line height plus its line gap
    const lineHeights = lines.map(
        (line) => textWrap.getLineHeight(line) + getLineGap(line)
    )
    const getLineY = (lineIndex: number): number =>
        yOffset + _.sum(lineHeights.slice(1, lineIndex + 1))

    return (
        <g id={id} className="markdown-text-wrap">
            <text
                x={roundForSvg(x)}
                y={roundForSvg(yOffset)}
                fontFamily={fontFamily}
                style={style}
                {...svgTextProps}
            >
                {lines.map((line, lineIndex) => {
                    const lineX = roundForSvg(x)
                    const lineY = roundForSvg(getLineY(lineIndex))
                    return (
                        <tspan key={lineIndex} x={lineX} y={lineY}>
                            {renderSvgLine(line, {
                                x: lineX,
                                y: lineY,
                                textAnchor: svgTextProps.textAnchor,
                            })}
                        </tspan>
                    )
                })}
            </text>
            {/* SVG doesn't support dotted underlines, so we draw them manually */}
            {detailsMarker === "underline" &&
                lines.map((line, lineIndex) => {
                    const lineY = roundForSvg(getLineY(lineIndex) + 2)
                    return getDodUnderlineSegments(line).map(
                        (segment, segmentIndex) => (
                            <line
                                key={`${lineIndex}-${segmentIndex}`}
                                className="dod-underline"
                                x1={roundForSvg(x + segment.x)}
                                y1={lineY}
                                x2={roundForSvg(x + segment.x + segment.width)}
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

/**
 * Baseline shift that makes Figma's SVG importer start a new text node.
 *
 * Figma merges runs on the same baseline into one text node and takes the
 * node's font weight, style and decoration from its first run, so text that
 * has to keep its own style must sit on a slightly different baseline. The
 * shift is too small to be visible in browsers.
 */
export const FIGMA_TEXT_NODE_BREAK_DY = 0.01

interface SvgLinePosition {
    x: number
    y: number
    textAnchor?: string
}

function renderSvgLine(
    line: IRToken[],
    position: SvgLinePosition
): React.ReactNode[] {
    const nodes = line.map((token, tokenIndex) => token.toSVG(tokenIndex))
    const [first, ...rest] = nodes

    const startsWithPlainText = !isTspan(first) && !isStyledElement(first)
    if (startsWithPlainText) return nodes

    return correctLineStartForFigma(first, rest, position)
}

/**
 * Rewrites a line that starts with a nested element for Figma's SVG import
 *
 * <tspan x="10" y="32">
 *      <tspan style="font-weight:700">Data source:</tspan> UN WPP
 * </tspan>
 *
 * becomes
 *
 * <tspan x="10" y="32">
 *   <tspan style="font-weight:700" x="10" y="32">Data source:</tspan>
 *   <tspan dy="0.01" xml:space="preserve"> UN WPP</tspan>
 * </tspan>
 */
function correctLineStartForFigma(
    first: React.ReactNode,
    rest: React.ReactNode[],
    { x, y, textAnchor }: SvgLinePosition
): React.ReactNode[] {
    // Figma joins a line that starts with a nested tspan onto the previous
    // line. Repeating the line's x/y on the nested tspan keeps the break.
    const positionedFirst = isTspan(first)
        ? React.cloneElement(first, { x, y })
        : first

    const isStartAnchored = !textAnchor || textAnchor === "start"
    const needsNodeBreak =
        isStartAnchored && isStyledElement(first) && rest.length > 0
    if (!needsNodeBreak) return [positionedFirst, ...rest]

    // Figma styles a whole text node like its first run, so split off the rest
    return [
        positionedFirst,
        <tspan
            key="rest"
            dy={FIGMA_TEXT_NODE_BREAK_DY}
            // librsvg (Wikimedia's renderer) drops a leading space otherwise
            xmlSpace="preserve"
        >
            {rest}
        </tspan>,
    ]
}

type SvgElement = React.ReactElement<React.SVGProps<SVGTSpanElement>>

function isTspan(node: React.ReactNode): node is SvgElement {
    return React.isValidElement(node) && node.type === "tspan"
}

function isStyledElement(node: React.ReactNode): boolean {
    if (!React.isValidElement<React.SVGProps<SVGTSpanElement>>(node))
        return false
    return (
        node.type === "a" ||
        _.some(node.props.style, (value) => value !== undefined)
    )
}
