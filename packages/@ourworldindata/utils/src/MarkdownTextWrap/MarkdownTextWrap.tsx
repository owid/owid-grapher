import React, { CSSProperties } from "react"
import { computed } from "mobx"
import { EveryMarkdownNode, MarkdownRoot, mdParser } from "./parser"
import { excludeUndefined, last, sum, imemo } from "../Util.js"
import { Bounds, FontFamily } from "../Bounds.js"
import { TextWrap } from "../TextWrap/TextWrap.js"

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
        return <span key={key}>{this.text}</span>
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
        return <span key={key}> </span>
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

export class IRSuperscript implements IRToken {
    constructor(public text: string, public fontParams?: IRFontParams) {}
    @imemo get width(): number {
        return Bounds.forText(this.text, { fontSize: this.height / 2 }).width
    }
    @imemo get height(): number {
        return this.fontParams?.fontSize || 16
    }
    getBreakpointBefore(): undefined {
        return undefined
    }
    toHTML(key?: React.Key): JSX.Element {
        return <sup key={key}>{this.text}</sup>
    }
    toSVG(key?: React.Key): JSX.Element {
        return (
            <React.Fragment key={key}>
                <tspan
                    style={{
                        fontSize: this.height / 2,
                    }}
                    dy={-this.height / 3}
                >
                    {this.text}
                </tspan>
                {/*
                    can't use baseline-shift as it's not supported in firefox
                    can't use transform translations on tspans
                    so we use dy translations but they apply to all subsequent elements
                    so we need a "reset" element to counteract each time
                 */}
                <tspan dy={this.height / 3} style={{ fontSize: 0 }}>
                    {" "}
                </tspan>
            </React.Fragment>
        )
    }
    toPlaintext(): string {
        return this.text
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
                style={{ textDecoration: "underline" }}
                rel="noopener noreferrer"
            >
                {this.children.map((child, i) => child.toSVG(i))}
            </a>
        )
    }
}

export class IRDetailOnDemand extends IRElement {
    constructor(
        public term: string,
        children: IRToken[],
        fontParams?: IRFontParams
    ) {
        super(children, fontParams)
    }
    getClone(children: IRToken[]): IRDetailOnDemand {
        return new IRDetailOnDemand(this.term, children, this.fontParams)
    }
    toHTML(key?: React.Key): JSX.Element {
        return (
            <span key={key}>
                <a className="dod-span" data-id={this.term}>
                    {this.children.map((child, i) => child.toHTML(i))}
                </a>
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

export const isTextToken = (token: IRToken): token is IRText | IRWhitespace =>
    token instanceof IRText || token instanceof IRWhitespace

/**
 * Merges adjacent text tokens, because the way we render text in React is otherwise
 * not very compatible with Google Translate, breaking our site in weird ways when
 * translated.
 * This is to be run _just before_ rendering to HTML, because it loses some
 * information and is not easily reversible.
 * See also https://github.com/owid/owid-grapher/issues/1785
 */
export const recursiveMergeTextTokens = (tokens: IRToken[]): IRToken[] => {
    if (tokens.length === 0) return []

    // merge adjacent text tokens into one
    const mergedTextTokens: IRToken[] = tokens.reduce((acc, token) => {
        if (isTextToken(token)) {
            const l = last(acc)
            if (l && isTextToken(l)) {
                // replace last value in acc with merged text token
                acc.pop()
                return [
                    ...acc,
                    new IRText(l.toPlaintext() + token.toPlaintext()),
                ]
            }
        }
        return [...acc, token]
    }, [] as IRToken[])

    // recursively enter non-text tokens, and merge their children
    return mergedTextTokens.map((token) => {
        if (token instanceof IRElement) {
            return token.getClone(recursiveMergeTextTokens(token.children))
        }
        return token
    })
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
    style?: CSSProperties
    detailsOrderedByReference?: Set<string>
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
    @computed get detailsOrderedByReference(): Set<string> {
        return this.props.detailsOrderedByReference || new Set()
    }
    @computed get ast(): MarkdownRoot["children"] {
        if (!this.text) return []
        const result = mdParser.markdown.parse(this.props.text)
        if (result.status) {
            return result.value.children
        }
        return []
    }

    @computed get plaintext(): string {
        return this.htmlLines.map(lineToPlaintext).join("\n")
    }

    @computed get htmlLines(): IRToken[][] {
        const tokens = parsimmonToTextTokens(this.ast, this.fontParams)
        const lines = splitIntoLines(tokens, this.maxWidth)
        return lines.map(recursiveMergeTextTokens)
    }

    // We render DoDs differently for SVG (superscript reference  numbers) so we need to calculate
    // their width differently. Height should remain the same.
    @computed get svgLines(): IRToken[][] {
        const references = this.detailsOrderedByReference
        function appendReferenceNumbers(tokens: IRToken[]): IRToken[] {
            function traverse(
                token: IRToken,
                callback: (token: IRToken) => any
            ): any {
                if (token instanceof IRElement) {
                    token.children.flatMap((child) => traverse(child, callback))
                }
                return callback(token)
            }

            const appendedTokens: IRToken[] = tokens.flatMap((token) =>
                traverse(token, (token: IRToken) => {
                    if (token instanceof IRDetailOnDemand) {
                        const referenceIndex =
                            [...references].findIndex(
                                (term) => term === token.term
                            ) + 1
                        if (referenceIndex === 0) return token
                        token.children.push(
                            new IRSuperscript(
                                String(referenceIndex),
                                token.fontParams
                            )
                        )
                    }
                    return token
                })
            )

            return appendedTokens
        }

        const tokens = parsimmonToTextTokens(this.ast, this.fontParams)
        const tokensWithReferenceNumbers = appendReferenceNumbers(tokens)
        return splitIntoLines(tokensWithReferenceNumbers, this.maxWidth)
    }

    @computed get height(): number {
        const { htmlLines, lineHeight, fontSize } = this
        if (htmlLines.length === 0) return 0
        return htmlLines.length * lineHeight * fontSize
    }

    @computed get style(): any {
        return {
            ...this.fontParams,
            ...this.props.style,
            lineHeight: this.lineHeight,
        }
    }

    renderHTML(): JSX.Element | null {
        const { htmlLines } = this
        if (htmlLines.length === 0) return null
        return (
            <span style={this.style} className="markdown-text-wrap">
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

    renderSVG(
        x: number,
        y: number,
        options?: React.SVGProps<SVGTextElement>
    ): JSX.Element | null {
        const { svgLines, fontSize, lineHeight } = this
        if (svgLines.length === 0) return null

        // Magic number set through experimentation.
        // The HTML and SVG renderers need to position lines identically.
        // This number was tweaked until the overlaid HTML and SVG outputs
        // overlap.
        const HEIGHT_CORRECTION_FACTOR = 0.74

        const textHeight = fontSize * HEIGHT_CORRECTION_FACTOR
        const containerHeight = lineHeight * fontSize
        const yOffset =
            y + (containerHeight - (containerHeight - textHeight) / 2)
        return (
            <text
                x={x.toFixed(1)}
                y={yOffset.toFixed(1)}
                style={this.style}
                {...options}
            >
                {svgLines.map((line, i) => (
                    <tspan
                        key={i}
                        x={x}
                        y={(yOffset + lineHeight * fontSize * i).toFixed(1)}
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

function MarkdownTextWrapLine({ line }: { line: IRToken[] }): JSX.Element {
    return (
        <span className="markdown-text-wrap__line">
            {line.length ? line.map((token, i) => token.toHTML(i)) : <br />}
        </span>
    )
}
