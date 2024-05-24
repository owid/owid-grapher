import React, { CSSProperties } from "react"
import { computed } from "mobx"
import {
    excludeUndefined,
    last,
    sum,
    sumBy,
    imemo,
    max,
    get,
    Bounds,
    FontFamily,
    dropWhile,
    dropRightWhile,
    cloneDeep,
} from "@ourworldindata/utils"
import { DetailsMarker } from "@ourworldindata/types"
import { TextWrap } from "../TextWrap/TextWrap.js"
import fromMarkdown from "mdast-util-from-markdown"
import type { Root, Content } from "mdast"
import { match } from "ts-pattern"
import { urlRegex } from "../markdown/remarkPlainLinks.js"

const SUPERSCRIPT_NUMERALS = {
    "0": "\u2070",
    "1": "\u00b9",
    "2": "\u00b2",
    "3": "\u00b3",
    "4": "\u2074",
    "5": "\u2075",
    "6": "\u2076",
    "7": "\u2077",
    "8": "\u2078",
    "9": "\u2079",
}

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
    constructor(
        public text: string,
        public fontParams?: IRFontParams
    ) {}
    @imemo get width(): number {
        return Bounds.forText(this.text, this.fontParams).width
    }
    @imemo get height(): number {
        return this.fontParams?.fontSize || 13
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
    constructor(
        public children: IRToken[],
        public fontParams?: IRFontParams
    ) {}

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
    constructor(
        public text: string,
        public fontParams?: IRFontParams
    ) {}
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
        // replace numerals with literals, for everything else let the font-feature handle it
        const style = { fontFeatureSettings: '"sups"' }
        const text = this.text.replace(/./g, (c) =>
            get(SUPERSCRIPT_NUMERALS, c, c)
        )
        return (
            <React.Fragment key={key}>
                <tspan style={style}>{text}</tspan>
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
            <tspan key={key} className="dod-span" data-id={this.term}>
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
export const recursiveMergeTextTokens = (
    tokens: IRToken[],
    fontParams?: IRFontParams
): IRToken[] => {
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
                    new IRText(
                        l.toPlaintext() + token.toPlaintext(),
                        fontParams
                    ),
                ]
            }
        }
        return [...acc, token]
    }, [] as IRToken[])

    // recursively enter non-text tokens, and merge their children
    return mergedTextTokens.map((token) => {
        if (token instanceof IRElement) {
            return token.getClone(
                recursiveMergeTextTokens(token.children, fontParams)
            )
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
): number =>
    sum(elements.map((element) => element.height)) +
    (elements.length - 1) * spacer

type MarkdownTextWrapProps = {
    text: string
    fontSize: number
    fontFamily?: FontFamily
    fontWeight?: number
    lineHeight?: number
    maxWidth?: number
    style?: CSSProperties
    detailsOrderedByReference?: string[]
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
        // NOTE: ❗Here we deviate from the normal markdown spec. We replace \n with <SPACE><SPACE>\n to make sure that single \n are treated as
        // actual line breaks but only if none of the other markdown line break rules apply.
        // This is a bit different to how markdown usually works but we have a substantial
        // amount of legacy charts that use newlines in this way and it seems that it is
        // better to support this simple case than to do a data migration of many chart subtitles.
        const baseText = this.props.text
        // This replace is a bit funky - we want to make sure that single \n are treated as
        // actual line breaks but only if none of the other markdown line break rules apply.
        // These are:
        // - \n\n is always a new paragraph
        // - Two spaces before \n is a line break (this rule is not entirely checked as we only check for a single space)
        // - A backslash before \n is a line break
        // The code below normalizes all cases to <SPACE><SPACE>\n which will lead to them surviving the markdown parsing
        let text = baseText.trim()
        text = text.replaceAll("\n\n", "@@LINEBREAK@@")
        text = text.replaceAll("\\\n", "@@LINEBREAK@@")
        text = text.replaceAll("  \n", "@@LINEBREAK@@")
        text = text.replaceAll("\n", "  \n")
        text = text.replaceAll("@@LINEBREAK@@", "  \n")
        return text
    }
    @computed get detailsOrderedByReference(): string[] {
        return this.props.detailsOrderedByReference || []
    }

    @computed get plaintext(): string {
        return this.htmlLines.map(lineToPlaintext).join("\n")
    }

    @computed get tokensFromMarkdown(): IRToken[] {
        const tokens = convertMarkdownToIRTokens(this.text, this.fontParams)
        return tokens
    }

    @computed get htmlLines(): IRToken[][] {
        const tokens = this.tokensFromMarkdown
        const lines = splitIntoLines(tokens, this.maxWidth)
        return lines.map((line) =>
            recursiveMergeTextTokens(line, this.fontParams)
        )
    }

    @computed get svgLines(): IRToken[][] {
        const tokens = this.tokensFromMarkdown
        const lines = splitIntoLines(tokens, this.maxWidth)
        return lines
    }

    @computed get svgLinesWithDodReferenceNumbers(): IRToken[][] {
        const references = this.detailsOrderedByReference
        const tokens = this.tokensFromMarkdown
        const tokensWithReferenceNumbers = appendReferenceNumbers(
            tokens,
            references
        )
        return splitIntoLines(tokensWithReferenceNumbers, this.maxWidth)
    }

    @computed get width(): number {
        const { htmlLines } = this
        const lineLengths = htmlLines.map((tokens) =>
            sumBy(tokens, (token) => token.width)
        )
        return max(lineLengths) ?? 0
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
        {
            textProps,
            detailsMarker = "superscript",
            id,
        }: {
            textProps?: React.SVGProps<SVGTextElement>
            detailsMarker?: DetailsMarker
            id?: string
        } = {}
    ): JSX.Element | null {
        const { fontSize, lineHeight } = this
        const lines =
            detailsMarker === "superscript"
                ? this.svgLinesWithDodReferenceNumbers
                : this.svgLines
        if (lines.length === 0) return null

        // Magic number set through experimentation.
        // The HTML and SVG renderers need to position lines identically.
        // This number was tweaked until the overlaid HTML and SVG outputs
        // overlap.
        const HEIGHT_CORRECTION_FACTOR = 0.74

        const textHeight = fontSize * HEIGHT_CORRECTION_FACTOR
        const containerHeight = lineHeight * fontSize
        const yOffset =
            y + (containerHeight - (containerHeight - textHeight) / 2)

        const getLineY = (lineIndex: number) =>
            yOffset + lineHeight * fontSize * lineIndex

        return (
            <g id={id} className="markdown-text-wrap">
                <text
                    x={x.toFixed(1)}
                    y={yOffset.toFixed(1)}
                    style={this.style}
                    {...textProps}
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
                        const y = (getLineY(lineIndex) + 2).toFixed(1)
                        let currWidth = 0
                        return line.map((token) => {
                            const underline =
                                token instanceof IRDetailOnDemand ? (
                                    <line
                                        className="dod-underline"
                                        x1={x + currWidth}
                                        y1={y}
                                        x2={x + currWidth + token.width}
                                        y2={y}
                                        stroke="currentColor"
                                        strokeWidth={1}
                                        strokeDasharray={1}
                                        // important for rotated text
                                        transform={textProps?.transform}
                                    />
                                ) : null
                            currWidth += token.width
                            return underline
                        })
                    })}
            </g>
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

export function convertMarkdownToIRTokens(
    markdown: string,
    fontParams?: IRFontParams
): IRToken[] {
    const ast: Root = fromMarkdown(markdown)
    const children = ast.children.flatMap((item: Content) =>
        convertMarkdownNodeToIRTokens(item, fontParams)
    )
    // ensure that there are no leading or trailing line breaks
    return dropRightWhile(
        dropWhile(children, (token) => token instanceof IRLineBreak),
        (token) => token instanceof IRLineBreak
    )
}

// When using mdast types version 4 this should be typed as:
// node: RootContentMap[keyof RootContentMap]
function convertMarkdownNodeToIRTokens(
    node: Content,
    fontParams: IRFontParams = {}
): IRToken[] {
    const converted = match(node)
        .with(
            {
                type: "blockquote",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "break",
            },
            (_) => {
                return [new IRLineBreak()]
            }
        )
        .with(
            {
                type: "code",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .with(
            {
                type: "emphasis",
            },
            (item) => {
                return [
                    new IRItalic(
                        item.children.flatMap((child) =>
                            convertMarkdownNodeToIRTokens(child, {
                                ...fontParams,
                                isItalic: true,
                            })
                        )
                    ),
                ]
            }
        )
        .with(
            {
                type: "heading",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "html",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .with(
            {
                type: "image",
            },
            (item) => {
                return [new IRText(item.alt ?? "", fontParams)]
            }
        )
        .with(
            {
                type: "inlineCode",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .with(
            {
                type: "link",
            },
            (item) => {
                if (item.url.startsWith("#dod:")) {
                    const term = item.url.replace("#dod:", "")
                    return [
                        new IRDetailOnDemand(
                            term,
                            item.children.flatMap((child) =>
                                convertMarkdownNodeToIRTokens(child, fontParams)
                            ),
                            fontParams
                        ),
                    ]
                } else
                    return [
                        new IRLink(
                            item.url,
                            item.children.flatMap((child) =>
                                convertMarkdownNodeToIRTokens(child, fontParams)
                            )
                        ),
                    ]
            }
        )
        .with(
            {
                type: "list",
            },
            (item) => {
                if (item.ordered)
                    return item.children.flatMap((child, index) => [
                        new IRLineBreak(),
                        new IRText(`${index + 1}) `, fontParams),
                        ...convertMarkdownNodeToIRTokens(child, fontParams),
                    ])
                else
                    return item.children.flatMap((child) => [
                        new IRLineBreak(),
                        new IRText(`• `, fontParams),
                        ...convertMarkdownNodeToIRTokens(child, fontParams),
                    ])
            }
        )
        .with(
            {
                type: "listItem",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "paragraph",
            },
            (item) => {
                return [
                    ...item.children.flatMap((child) =>
                        convertMarkdownNodeToIRTokens(child, fontParams)
                    ),
                ]
            }
        )
        .with(
            {
                type: "strong",
            },
            (item) => {
                return [
                    new IRBold(
                        item.children.flatMap((child) =>
                            convertMarkdownNodeToIRTokens(child, {
                                ...fontParams,
                                fontWeight: 700,
                            })
                        )
                    ),
                ]
            }
        )
        .with(
            {
                type: "text",
            },
            (item) => {
                const splitted = item.value.split(/\s+/)
                const tokens = splitted.flatMap((text, i) => {
                    const textNode = new IRText(text, fontParams)
                    const node = text.match(urlRegex)
                        ? new IRLink(text, [textNode], fontParams)
                        : textNode
                    if (i < splitted.length - 1) {
                        return [node, new IRWhitespace(fontParams)]
                    } else return [node]
                })
                return tokens
            }
        )
        .with(
            {
                type: "thematicBreak",
            },
            (_) => {
                return [new IRText("---", fontParams)]
            }
        )
        .with(
            {
                type: "delete",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        // Now lets finish this with blocks for FootnoteDefinition, Definition, ImageReference, LinkReference, FootnoteReference, and Table
        .with(
            {
                type: "footnoteDefinition",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "definition",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "imageReference",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "linkReference",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "footnoteReference",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "table",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "tableCell",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        // and now TableRow and Yaml
        .with(
            {
                type: "tableRow",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "yaml",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .with(
            {
                type: "footnote",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .exhaustive()
    return converted
}

function appendReferenceNumbers(
    tokens: IRToken[],
    references: string[]
): IRToken[] {
    function traverse(token: IRToken, callback: (token: IRToken) => any): any {
        if (token instanceof IRElement) {
            token.children.flatMap((child) => traverse(child, callback))
        }
        return callback(token)
    }

    const appendedTokens: IRToken[] = cloneDeep(tokens).flatMap((token) =>
        traverse(token, (token: IRToken) => {
            if (token instanceof IRDetailOnDemand) {
                const referenceIndex =
                    references.findIndex((term) => term === token.term) + 1
                if (referenceIndex === 0) return token
                token.children.push(
                    new IRSuperscript(String(referenceIndex), token.fontParams)
                )
            }
            return token
        })
    )

    return appendedTokens
}
