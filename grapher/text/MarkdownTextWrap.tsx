import React from "react"
import { computed } from "mobx"
import { EveryMarkdownNode, MarkdownRoot, mdParser } from "./parser.js"
import { Bounds, FontFamily } from "../../clientUtils/Bounds.js"
import { imemo } from "../../coreTable/CoreTableUtils.js"
import { excludeUndefined, sum } from "../../clientUtils/Util.js"

export interface IRFontParams {
    fontSize?: number
    fontWeight?: number
    fontFamily?: FontFamily
}

export interface IRBreakpoint {
    tokenIndex: number
    tokenStartOffset: number
    breakOffset: number
}

export interface IRToken {
    width: number
    getBreakpointBefore(targetWidth: number): IRBreakpoint | undefined
    toHTML(key: number | string): JSX.Element | undefined
    toSVG(key: number | string): JSX.Element | undefined
    toPlaintext(): string | undefined
}

export class IRText implements IRToken {
    constructor(public text: string, public fontParams?: IRFontParams) {}
    @imemo get width(): number {
        return Bounds.forText(this.text, this.fontParams).width
    }
    getBreakpointBefore(): undefined {
        return undefined
    }
    toHTML(key: number | string): JSX.Element {
        return <React.Fragment key={key}>{this.text}</React.Fragment>
    }
    toSVG(key: number | string): JSX.Element {
        return <React.Fragment key={key}>{this.text}</React.Fragment>
    }
    toPlaintext(): string {
        return this.text
    }
}

export class IRWhitespace implements IRToken {
    constructor(public fontParams?: IRFontParams) {}
    @imemo get width(): number {
        return Bounds.forText(" ", this.fontParams).width
    }
    getBreakpointBefore(): IRBreakpoint {
        // Have to give it some `breakOffset` because we designate locations
        // to split based on it, and `0` leads to being exactly in between tokens.
        return { tokenIndex: 0, tokenStartOffset: 0, breakOffset: 0.0001 }
    }
    toHTML(key: number | string): JSX.Element {
        return <React.Fragment key={key}> </React.Fragment>
    }
    toSVG(key: number | string): JSX.Element {
        return <React.Fragment key={key}> </React.Fragment>
    }
    toPlaintext(): string {
        return " "
    }
}

export class IRLineBreak implements IRToken {
    get width(): number {
        return 0
    }
    getBreakpointBefore(): undefined {
        return undefined
    }
    toHTML(key: number | string): JSX.Element {
        return <br key={key} />
    }
    toSVG(): undefined {
        // We have to deal with this special case in
        // whatever procedure does text reflow.
        return undefined
    }
    toPlaintext(): string {
        return "\n"
    }
}

export abstract class IRElement implements IRToken {
    constructor(public children: IRToken[], public fontParams?: IRFontParams) {}

    @imemo get width(): number {
        return getLineWidth(this.children)
    }

    getBreakpointBefore(targetWidth: number): IRBreakpoint | undefined {
        return getBreakpointBefore(this.children, targetWidth)
    }

    splitBefore(maxWidth: number): {
        before: IRToken | undefined
        after: IRToken | undefined
    } {
        const { before, after } = splitLineAtBreakpoint(this.children, maxWidth)
        return {
            // do not create tokens without children
            before: before.length ? this.getClone(before) : undefined,
            after: after.length ? this.getClone(after) : undefined,
        }
    }

    splitOnNextLineBreak(): { before?: IRToken; after?: IRToken } {
        const index = this.children.findIndex(
            (token) => token instanceof IRLineBreak
        )
        if (index >= 0) {
            return {
                before:
                    // do not create an empty element if the first child
                    // is a newline
                    index === 0
                        ? undefined
                        : this.getClone(this.children.slice(0, index)),
                after: this.getClone(this.children.slice(index + 1)),
            }
        }
        return { before: this }
    }

    abstract getClone(children: IRToken[]): IRElement
    abstract toHTML(key: number | string): JSX.Element
    abstract toSVG(key: number | string): JSX.Element

    toPlaintext(): string {
        return lineToPlaintext(this.children)
    }
}

export class IRBold extends IRElement {
    getClone(children: IRToken[]): IRBold {
        return new IRBold(children, this.fontParams)
    }
    toHTML(key: number | string): JSX.Element {
        return (
            <strong key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </strong>
        )
    }
    toSVG(key: number | string): JSX.Element {
        return (
            <tspan key={key} style={{ fontWeight: 700 }}>
                {this.children.map((child, i) => child.toSVG(i))}
            </tspan>
        )
    }
}

export class IRSpan extends IRElement {
    getClone(children: IRToken[]): IRSpan {
        return new IRSpan(children, this.fontParams)
    }
    toHTML(key: number | string): JSX.Element {
        return (
            <span key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </span>
        )
    }
    toSVG(key: number | string): JSX.Element {
        return (
            <tspan key={key}>
                {this.children.map((child, i) => child.toSVG(i))}
            </tspan>
        )
    }
}

export class IRItalic extends IRElement {
    getClone(children: IRToken[]): IRItalic {
        return new IRItalic(children, this.fontParams)
    }
    toHTML(key: number | string): JSX.Element {
        return (
            <em key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </em>
        )
    }
    toSVG(key: number | string): JSX.Element {
        return (
            <tspan key={key} style={{ fontStyle: "italic" }}>
                {this.children.map((child, i) => child.toSVG(i))}
            </tspan>
        )
    }
}

export class IRLink extends IRElement {
    constructor(
        public href: string,
        children: IRToken[],
        fontParams?: IRFontParams
    ) {
        super(children, fontParams)
    }
    getClone(children: IRToken[]): IRLink {
        return new IRLink(this.href, children, this.fontParams)
    }
    toHTML(key: number | string): JSX.Element {
        return (
            <a key={key} href={this.href}>
                {this.children.map((child, i) => child.toHTML(i))}
            </a>
        )
    }
    toSVG(key: number | string): JSX.Element {
        return (
            <a key={key} href={this.href}>
                {this.children.map((child, i) => child.toSVG(i))}
            </a>
        )
    }
}

function splitAllOnNewline(tokens: IRToken[]): IRToken[][] {
    let currentLine: IRToken[] = []
    const lines: IRToken[][] = [currentLine]
    const unproccessed: IRToken[] = [...tokens]
    while (unproccessed.length > 0) {
        const token = unproccessed.shift()!
        if (token instanceof IRElement) {
            const { before, after } = token.splitOnNextLineBreak()
            if (before) currentLine.push(before)
            if (after) {
                currentLine = []
                lines.push(currentLine)
                // move to unprocessed stack, it might contain futher newlines
                unproccessed.unshift(after)
            }
        } else if (token instanceof IRLineBreak) {
            currentLine = []
            lines.push(currentLine)
        } else {
            currentLine.push(token)
        }
    }
    return lines
}

export function splitLineAtBreakpoint(
    tokens: IRToken[],
    breakWidth: number
): { before: IRToken[]; after: IRToken[] } {
    let i = 0
    let offset = 0
    // finding the token where the split should be
    // NOTE: the token may not be splittable, which is why we need an exact
    // `breakWidth` provided, not the line width.
    while (i < tokens.length - 1 && offset + tokens[i].width < breakWidth) {
        offset += tokens[i].width
        i++
    }
    const token = tokens[i]
    if (token instanceof IRElement) {
        const { before, after } = token.splitBefore(breakWidth - offset)
        return {
            before: excludeUndefined([...tokens.slice(0, i), before]),
            after: excludeUndefined([after, ...tokens.slice(i + 1)]),
        }
    } else {
        return { before: tokens.slice(0, i), after: trimLeft(tokens.slice(i)) }
    }
}

function trimLeft(tokens: IRToken[]): IRToken[] {
    let i = 0
    while (i < tokens.length && tokens[i] instanceof IRWhitespace) {
        i++
    }
    return tokens.slice(i)
}

// Even though it says "before", it may return a breakpoint after, because
// there is no earlier breakpoint in the line.
export function getBreakpointBefore(
    tokens: IRToken[],
    maxWidth: number
): IRBreakpoint | undefined {
    let tokenStartOffset = 0
    let prevBreakpoint: IRBreakpoint | undefined = undefined
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]
        const candidate = token.getBreakpointBefore(maxWidth - tokenStartOffset)
        if (candidate !== undefined) {
            if (
                prevBreakpoint &&
                candidate.breakOffset + tokenStartOffset > maxWidth
            ) {
                break
            }
            prevBreakpoint = {
                tokenStartOffset,
                tokenIndex: index,
                breakOffset: candidate.breakOffset + tokenStartOffset,
            }
        }
        tokenStartOffset += token.width
    }
    return prevBreakpoint
}

export function getLineWidth(tokens: IRToken[]): number {
    return sum(tokens.map((token) => token.width))
}

// useful for debugging
export function lineToPlaintext(tokens: IRToken[]): string {
    return tokens.map((t) => t.toPlaintext()).join("")
}

export function splitIntoLines(
    tokens: IRToken[],
    maxWidth: number
): IRToken[][] {
    const processedLines: IRToken[][] = []
    const unprocessedLines: IRToken[][] = splitAllOnNewline(tokens)
    while (unprocessedLines.length) {
        const currentLine = unprocessedLines.shift()!
        if (getLineWidth(currentLine) <= maxWidth) {
            processedLines.push(currentLine)
        } else {
            const breakpoint = getBreakpointBefore(currentLine, maxWidth)
            if (!breakpoint) {
                processedLines.push(currentLine)
            } else {
                const { before, after } = splitLineAtBreakpoint(
                    currentLine,
                    breakpoint.breakOffset
                )
                processedLines.push(before)
                unprocessedLines.unshift(after)
            }
        }
    }
    return processedLines
}

export function parsimmonToTextTokens(
    nodes: EveryMarkdownNode[],
    fontParams?: IRFontParams
): IRToken[] {
    return nodes.map((node): IRToken => {
        if (node.type === "text") {
            return new IRText(node.value, fontParams)
        } else if (node.type === "newline") {
            return new IRLineBreak()
        } else if (node.type === "whitespace") {
            return new IRWhitespace(fontParams)
        } else if (
            node.type === "bold" ||
            node.type === "plainBold" ||
            node.type === "boldWithoutItalic"
        ) {
            return new IRBold(
                parsimmonToTextTokens(node.children, {
                    ...fontParams,
                    fontWeight: 700,
                })
            )
        } else if (
            node.type === "italic" ||
            node.type === "plainItalic" ||
            node.type === "italicWithoutBold"
        ) {
            return new IRItalic(
                parsimmonToTextTokens(node.children, {
                    ...fontParams,
                })
            )
        } else if (node.type === "textSegments") {
            return new IRSpan(
                parsimmonToTextTokens(node.children, {
                    ...fontParams,
                })
            )
        } else if (node.type === "plainUrl") {
            return new IRLink(
                node.href,
                parsimmonToTextTokens(
                    [{ type: "text", value: node.href }],
                    fontParams
                )
            )
        } else if (node.type === "markdownLink") {
            return new IRLink(
                node.href,
                parsimmonToTextTokens(node.children, fontParams)
            )
        } else if (node.type === "detailOnDemand") {
            // TODO: create a IR for this
            return new IRLink(
                node.term,
                parsimmonToTextTokens(node.children, fontParams)
            )
        } else {
            throw new Error(`Unknown node type: ${(node as any).type}`)
        }
    })
}

interface MarkdownTextWrapHTMLProps {
    isSVG?: false
    x?: number
    y?: number
    svgOptions?: React.SVGProps<SVGTextElement>
}

interface MarkdownTextWrapSVGProps {
    isSVG: true
    x: number
    y: number
    svgOptions?: React.SVGProps<SVGTextElement>
}

type MarkdownTextWrapProps = {
    text: string
    maxWidth: number
    lineHeight?: number
    fontSize: number
    fontWeight?: number
} & (MarkdownTextWrapHTMLProps | MarkdownTextWrapSVGProps)

export class MarkdownTextWrap extends React.Component {
    props: MarkdownTextWrapProps
    constructor(props: MarkdownTextWrapProps) {
        super(props)
        this.props = props
    }

    @computed get maxWidth(): number {
        return this.props.maxWidth ?? Infinity
    }
    @computed get lineHeight(): number {
        return this.props.lineHeight ?? 1.1
    }
    @computed get fontSize(): number {
        return this.props.fontSize ?? 1
    }
    @computed get fontWeight(): number | undefined {
        return this.props.fontWeight
    }
    @computed get text(): string {
        return this.props.text
    }
    @computed get ast(): MarkdownRoot["children"] {
        const result = mdParser.markdown.parse(this.props.text)
        if (result.status) {
            return result.value.children
        }
        return []
    }

    @computed get lines(): IRToken[][] {
        const tokens = parsimmonToTextTokens(this.ast)
        return splitIntoLines(tokens, this.maxWidth)
    }

    @computed get htmlStyle(): any {
        const { fontSize, fontWeight, lineHeight } = this
        return {
            fontSize: fontSize.toFixed(2) + "px",
            fontWeight: fontWeight,
            lineHeight: lineHeight,
            overflowY: "visible",
        }
    }

    render(): JSX.Element | null {
        const { props, lines, fontSize, fontWeight, lineHeight } = this

        if (lines.length === 0) return null

        if (props.isSVG) {
            return (
                <text
                    fontSize={fontSize.toFixed(2)}
                    fontWeight={fontWeight}
                    x={props.x.toFixed(1)}
                    y={props.y.toFixed(1)}
                    {...props.svgOptions}
                >
                    {lines.map((line, i) => (
                        <tspan
                            key={i}
                            x={props.x}
                            y={lineHeight * fontSize * (i + 1)}
                        >
                            {line.map((token, i) => token.toSVG(i))}
                        </tspan>
                    ))}
                </text>
            )
        }
        return (
            <span style={this.htmlStyle} className="markdown-text-wrap">
                {lines.map((line, i) => (
                    <span className="markdown-text-wrap__line" key={i}>
                        {line.length ? (
                            line.map((token, i) => token.toHTML(i))
                        ) : (
                            <br />
                        )}
                    </span>
                ))}
            </span>
        )
    }
}
