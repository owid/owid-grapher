import React from "react"
import { computed } from "mobx"
import { EveryMarkdownNode, MarkdownRoot, mdParser } from "./parser.js"
import { Bounds, FontFamily } from "../../clientUtils/Bounds.js"
import { imemo } from "../../coreTable/CoreTableUtils.js"
import { excludeUndefined, last, sum } from "../../clientUtils/Util.js"
import { DoDWrapper } from "../detailsOnDemand/detailsOnDemand.js"
import { TextWrap } from "./TextWrap.js"

export interface IRFontParams {
    fontSize?: number
    fontWeight?: number
    fontFamily?: FontFamily
    isItalic?: boolean
}

export interface IRBreakpoint {
    tokenIndex: number
    tokenStartOffset: number
    breakOffset: number
}

export interface IRToken {
    width: number
    getBreakpointBefore(targetWidth: number): IRBreakpoint | undefined
    toHTML(key?: React.Key): JSX.Element | undefined
    toSVG(key?: React.Key): JSX.Element | undefined
    toPlaintext(): string | undefined
}

export class IRText implements IRToken {
    constructor(public text: string, public fontParams?: IRFontParams) {}
    @imemo get width(): number {
        return Bounds.forText(this.text, this.fontParams).width
    }
    @imemo get height(): number {
        return this.fontParams?.fontSize || 16
    }
    getBreakpointBefore(): undefined {
        return undefined
    }
    toHTML(key?: React.Key): JSX.Element {
        return <React.Fragment key={key}>{this.text}</React.Fragment>
    }
    toSVG(key?: React.Key): JSX.Element {
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
    toHTML(key?: React.Key): JSX.Element {
        return <React.Fragment key={key}> </React.Fragment>
    }
    toSVG(key?: React.Key): JSX.Element {
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
    toHTML(key?: React.Key): JSX.Element {
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

    splitOnLineBreaks(): IRToken[][] {
        const lines = splitAllOnNewline(this.children)
        if (lines.length > 1) {
            return lines.map((tokens) =>
                // Do not create a clone without children.
                // There aren't any children in a line when the first or last
                // token is a newline.
                tokens.length ? [this.getClone(tokens)] : []
            )
        }
        // Do not create copies of element
        // if there are no newlines inside.
        return [[this]]
    }

    abstract getClone(children: IRToken[]): IRElement
    abstract toHTML(key?: React.Key): JSX.Element
    abstract toSVG(key?: React.Key): JSX.Element

    toPlaintext(): string {
        return lineToPlaintext(this.children)
    }
}

export class IRBold extends IRElement {
    getClone(children: IRToken[]): IRBold {
        return new IRBold(children, this.fontParams)
    }
    toHTML(key?: React.Key): JSX.Element {
        return (
            <strong key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </strong>
        )
    }
    toSVG(key?: React.Key): JSX.Element {
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
    toHTML(key?: React.Key): JSX.Element {
        return (
            <span key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </span>
        )
    }
    toSVG(key?: React.Key): JSX.Element {
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
    toHTML(key?: React.Key): JSX.Element {
        return (
            <em key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </em>
        )
    }
    toSVG(key?: React.Key): JSX.Element {
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
    toHTML(key?: React.Key): JSX.Element {
        return (
            <a
                key={key}
                href={this.href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {this.children.map((child, i) => child.toHTML(i))}
            </a>
        )
    }
    toSVG(key?: React.Key): JSX.Element {
        return (
            <a
                key={key}
                href={this.href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {" "}
                {this.children.map((child, i) => child.toSVG(i))}
            </a>
        )
    }
}

export class IRDetailOnDemand extends IRElement {
    constructor(
        public category: string,
        public term: string,
        children: IRToken[],
        fontParams?: IRFontParams
    ) {
        super(children, fontParams)
    }
    getClone(children: IRToken[]): IRDetailOnDemand {
        return new IRDetailOnDemand(
            this.category,
            this.term,
            children,
            this.fontParams
        )
    }
    toHTML(key?: React.Key): JSX.Element {
        return (
            <DoDWrapper key={key} term={this.term} category={this.category}>
                {this.children.map((child, i) => child.toHTML(i))}
            </DoDWrapper>
        )
    }
    toSVG(key?: React.Key): JSX.Element {
        return (
            <tspan key={key}>
                {this.children.map((child, i) => child.toSVG(i))}
            </tspan>
        )
    }
}

function splitAllOnNewline(tokens: IRToken[]): IRToken[][] {
    if (!tokens.length) return []
    let currentLine: IRToken[] = []
    const lines: IRToken[][] = [currentLine]
    const unproccessed: IRToken[] = [...tokens]
    while (unproccessed.length > 0) {
        const token = unproccessed.shift()!
        if (token instanceof IRElement) {
            const [firstLine, ...otherLines] = token.splitOnLineBreaks()
            if (firstLine) currentLine.push(...firstLine)
            if (otherLines.length) {
                lines.push(...otherLines)
                currentLine = last(lines)!
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

export const sumTextWrapHeights = (
    elements: MarkdownTextWrap[] | TextWrap[],
    spacer: number = 0
): number => sum(elements.map((element) => element.height + spacer))

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
                    isItalic: true,
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
            return new IRDetailOnDemand(
                node.category,
                node.term,
                parsimmonToTextTokens(node.children, fontParams)
            )
        } else {
            throw new Error(`Unknown node type: ${(node as any).type}`)
        }
    })
}

type MarkdownTextWrapProps = {
    text: string
    fontSize: number
    fontFamily?: FontFamily
    fontWeight?: number
    lineHeight?: number
    maxWidth?: number
}

export class MarkdownTextWrap extends React.Component<MarkdownTextWrapProps> {
    @computed get maxWidth(): number {
        return this.props.maxWidth ?? Infinity
    }
    @computed get lineHeight(): number {
        return this.props.lineHeight ?? 1.1
    }
    @computed get fontSize(): number {
        return this.props.fontSize
    }
    @computed get fontParams(): IRFontParams {
        return {
            fontFamily: this.props.fontFamily,
            fontSize: this.props.fontSize,
            fontWeight: this.props.fontWeight,
        }
    }
    @computed get text(): string {
        return this.props.text
    }
    @computed get ast(): MarkdownRoot["children"] {
        if (!this.text) return []
        const result = mdParser.markdown.parse(this.props.text)
        if (result.status) {
            return result.value.children
        }
        return []
    }

    @computed get lines(): IRToken[][] {
        const tokens = parsimmonToTextTokens(this.ast, this.fontParams)
        return splitIntoLines(tokens, this.maxWidth)
    }

    @computed get height(): number {
        return (
            this.lines.length * this.lineHeight * this.fontSize -
            this.lines.length * 2
        )
    }

    @computed get style(): any {
        return {
            ...this.fontParams,
            lineHeight: this.lineHeight,
        }
    }

    renderHTML(): JSX.Element | null {
        const { lines } = this
        if (lines.length === 0) return null
        return (
            <span style={this.style} className="markdown-text-wrap">
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

    renderSVG(
        x: number,
        y: number,
        options?: React.SVGProps<SVGTextElement>
    ): JSX.Element | null {
        const { lines } = this
        if (lines.length === 0) return null

        return (
            <text
                x={x.toFixed(1)}
                y={y.toFixed(1)}
                style={this.style}
                {...options}
            >
                {lines.map((line, i) => (
                    <tspan
                        key={i}
                        x={x}
                        y={(
                            this.lineHeight * this.props.fontSize * (i + 1) +
                            y
                        ).toFixed(1)}
                    >
                        {line.map((token, i) => token.toSVG(i))}
                    </tspan>
                ))}
            </text>
        )
    }

    // An alias method that allows MarkdownTextWrap to be
    // instantiated via JSX for HTML rendering
    // <MarkdownTextWrap ... />
    render(): JSX.Element | null {
        return this.renderHTML()
    }
}
