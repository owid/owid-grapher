import * as _ from "lodash-es"
import * as React from "react"
import {
    cssFontFamily,
    excludeUndefined,
    imemo,
    Bounds,
    FontFamily,
} from "@ourworldindata/utils"
import * as R from "remeda"

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
    fontParams?: IRFontParams
    getBreakpointBefore(targetWidth: number): IRBreakpoint | undefined
    toHTML(key?: React.Key): React.ReactElement | undefined
    toSVG(key?: React.Key): React.ReactElement | undefined
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
    toHTML(key?: React.Key): React.ReactElement {
        return <span key={key}>{this.text}</span>
    }
    toSVG(key?: React.Key): React.ReactElement {
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
    toHTML(key?: React.Key): React.ReactElement {
        return <span key={key}> </span>
    }
    toSVG(key?: React.Key): React.ReactElement {
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
    toHTML(key?: React.Key): React.ReactElement {
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
            after: after.length ? this.getContinuationClone(after) : undefined,
        }
    }

    splitOnLineBreaks(): IRToken[][] {
        const lines = splitAllOnNewline(this.children)
        if (lines.length > 1) {
            return lines.map((tokens, index) =>
                // Do not create a clone without children.
                // There aren't any children in a line when the first or last
                // token is a newline.
                tokens.length
                    ? [
                          index === 0
                              ? this.getClone(tokens)
                              : this.getContinuationClone(tokens),
                      ]
                    : []
            )
        }
        // Do not create copies of element
        // if there are no newlines inside.
        return [[this]]
    }

    abstract getClone(children: IRToken[]): IRElement

    /**
     * Clone holding the part of this element that continues on a new line
     * after a wrap or line break. Same as `getClone` except that elements
     * carrying gaps relative to the preceding content drop them here.
     */
    getContinuationClone(children: IRToken[]): IRElement {
        return this.getClone(children)
    }
    abstract toHTML(key?: React.Key): React.ReactElement
    abstract toSVG(key?: React.Key): React.ReactElement

    toPlaintext(): string {
        return lineToPlaintext(this.children)
    }
}

export class IRBold extends IRElement {
    getClone(children: IRToken[]): IRBold {
        return new IRBold(children, this.fontParams)
    }
    toHTML(key?: React.Key): React.ReactElement {
        return (
            <strong key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </strong>
        )
    }
    toSVG(key?: React.Key): React.ReactElement {
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
    toHTML(key?: React.Key): React.ReactElement {
        return (
            <span key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </span>
        )
    }
    toSVG(key?: React.Key): React.ReactElement {
        return (
            <tspan key={key}>
                {this.children.map((child, i) => child.toSVG(i))}
            </tspan>
        )
    }
}

export interface IRFragmentStyle {
    fontSize?: number
    fontFamily?: FontFamily
    fontWeight?: number
    color?: string
}

/** Wraps the tokens of a single TextWrapGroup fragment */
export class IRFragment extends IRElement {
    constructor(
        public fragmentIndex: number,
        children: IRToken[],
        public styleDelta: IRFragmentStyle = {},
        fontParams?: IRFontParams,
        /** Horizontal space before the fragment on its line */
        public inlineGap: number = 0,
        /**
         * Vertical space between the preceding line and the fragment's
         * first line. It can't be rendered by an inline element; it is
         * applied per line instead
         */
        public lineGap: number = 0
    ) {
        super(children, fontParams)
    }
    @imemo override get width(): number {
        return this.inlineGap + getLineWidth(this.children)
    }
    /**
     * The inherited implementation operates on the children alone, but this
     * fragment's width includes the inline gap, so breakpoints need to be
     * shifted by the gap. The gap itself is a break opportunity (like the
     * whitespace it replaces): if no internal breakpoint fits, the line may
     * break right before the fragment.
     */
    override getBreakpointBefore(
        targetWidth: number
    ): IRBreakpoint | undefined {
        if (!this.inlineGap) return super.getBreakpointBefore(targetWidth)
        const internal = super.getBreakpointBefore(targetWidth - this.inlineGap)
        if (internal && internal.breakOffset + this.inlineGap <= targetWidth)
            return {
                ...internal,
                breakOffset: internal.breakOffset + this.inlineGap,
            }
        return { tokenIndex: 0, tokenStartOffset: 0, breakOffset: 0.0001 }
    }
    override splitBefore(maxWidth: number): {
        before: IRToken | undefined
        after: IRToken | undefined
    } {
        if (!this.inlineGap) return super.splitBefore(maxWidth)
        // A break width within the gap moves the whole fragment to the next
        // line, where it continues without the gap
        if (maxWidth <= this.inlineGap)
            return {
                before: undefined,
                after: this.getContinuationClone(this.children),
            }
        const { before, after } = splitLineAtBreakpoint(
            this.children,
            maxWidth - this.inlineGap
        )
        return {
            before: before.length ? this.getClone(before) : undefined,
            after: after.length ? this.getContinuationClone(after) : undefined,
        }
    }
    getClone(children: IRToken[]): IRFragment {
        return new IRFragment(
            this.fragmentIndex,
            children,
            this.styleDelta,
            this.fontParams,
            this.inlineGap,
            this.lineGap
        )
    }
    override getContinuationClone(children: IRToken[]): IRFragment {
        // The gaps space the fragment from the preceding content, so they
        // don't carry over to continuation lines when the fragment wraps
        return new IRFragment(
            this.fragmentIndex,
            children,
            this.styleDelta,
            this.fontParams
        )
    }
    toHTML(key?: React.Key): React.ReactElement {
        const children = this.children.map((child, i) => child.toHTML(i))
        if (_.isEmpty(this.styleDelta) && !this.inlineGap)
            return <React.Fragment key={key}>{children}</React.Fragment>
        const { fontSize, fontFamily, fontWeight, color } = this.styleDelta
        return (
            <span
                key={key}
                style={{
                    display: "inline-block",
                    marginLeft: this.inlineGap || undefined,
                    fontSize,
                    fontWeight,
                    fontFamily: fontFamily
                        ? cssFontFamily(fontFamily)
                        : undefined,
                    color,
                }}
            >
                {children}
            </span>
        )
    }
    toSVG(key?: React.Key): React.ReactElement {
        const children = this.children.map((child, i) => child.toSVG(i))
        if (_.isEmpty(this.styleDelta) && !this.inlineGap)
            return <React.Fragment key={key}>{children}</React.Fragment>
        const { fontSize, fontFamily, fontWeight, color } = this.styleDelta
        return (
            <tspan
                key={key}
                dx={this.inlineGap || undefined}
                style={{
                    fontSize,
                    fontWeight,
                    fontFamily: fontFamily
                        ? cssFontFamily(fontFamily)
                        : undefined,
                    fill: color,
                }}
            >
                {children}
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
    toHTML(key?: React.Key): React.ReactElement {
        return <sup key={key}>{this.text}</sup>
    }
    toSVG(key?: React.Key): React.ReactElement {
        // replace numerals with literals, for everything else let the font-feature handle it
        const style = { fontFeatureSettings: '"sups"' }
        const text = this.text.replace(/./g, (c) =>
            _.get(SUPERSCRIPT_NUMERALS, c, c)
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
    toHTML(key?: React.Key): React.ReactElement {
        return (
            <em key={key}>
                {this.children.map((child, i) => child.toHTML(i))}
            </em>
        )
    }
    toSVG(key?: React.Key): React.ReactElement {
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
    toHTML(key?: React.Key): React.ReactElement {
        return (
            <a key={key} href={this.href}>
                {this.children.map((child, i) => child.toHTML(i))}
            </a>
        )
    }
    toSVG(key?: React.Key): React.ReactElement {
        return (
            <a
                key={key}
                href={this.href}
                style={{ textDecoration: "underline" }}
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
    toHTML(key?: React.Key): React.ReactElement {
        return (
            <span
                key={key}
                className="dod-span"
                data-id={this.term}
                tabIndex={0}
            >
                {this.children.map((child, i) => child.toHTML(i))}
            </span>
        )
    }
    toSVG(key?: React.Key): React.ReactElement {
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
                currentLine = R.last(lines)!
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
    return _.sum(tokens.map((token) => token.width))
}

/**
 * The largest font size of any token on the line, or `undefined` if none of
 * the tokens specifies a font size.
 */
export function getLineFontSize(tokens: IRToken[]): number | undefined {
    const tokenFontSize = (token: IRToken): number => {
        const ownFontSize = token.fontParams?.fontSize ?? 0
        const childrenFontSize =
            token instanceof IRElement
                ? (_.max(token.children.map(tokenFontSize)) ?? 0)
                : 0
        return Math.max(ownFontSize, childrenFontSize)
    }
    const maxFontSize = _.max(tokens.map(tokenFontSize)) ?? 0
    return maxFontSize > 0 ? maxFontSize : undefined
}

/**
 * Extra vertical space (in px) above the line: the largest line gap of any
 * fragment on the line. Fragments carry a line gap when they were placed on
 * a new line with an explicit gap; it is rendered as a line margin (HTML)
 * or an extra baseline offset (SVG).
 */
export function getLineGap(tokens: IRToken[]): number {
    return (
        _.max(
            tokens.map((token) =>
                token instanceof IRFragment ? token.lineGap : 0
            )
        ) ?? 0
    )
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
            const l = R.last(acc)
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

    // recursively enter non-text tokens, and merge their children;
    // elements that carry their own fontParams (e.g. IRFragment) pass those
    // down so merged text keeps the correct measurement params
    return mergedTextTokens.map((token) => {
        if (token instanceof IRElement) {
            return token.getClone(
                recursiveMergeTextTokens(
                    token.children,
                    token.fontParams ?? fontParams
                )
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

/**
 * Tokenizes plain text without any markdown parsing, so that literal markdown
 * characters (e.g. `*`, `_`, `[`) are preserved verbatim. Newlines become
 * hard line breaks.
 */
export function convertPlaintextToIRTokens(
    text: string,
    fontParams?: IRFontParams
): IRToken[] {
    const lines = text.split("\n")
    return lines.flatMap((line, lineIndex) => {
        const words = line.split(/\s+/).filter((word) => word.length > 0)
        const tokens: IRToken[] = words.flatMap((word, wordIndex) =>
            wordIndex < words.length - 1
                ? [new IRText(word, fontParams), new IRWhitespace(fontParams)]
                : [new IRText(word, fontParams)]
        )
        return lineIndex < lines.length - 1
            ? [...tokens, new IRLineBreak()]
            : tokens
    })
}

export function appendReferenceNumbers(
    tokens: IRToken[],
    references: string[]
): IRToken[] {
    function traverse(token: IRToken, callback: (token: IRToken) => any): any {
        if (token instanceof IRElement) {
            token.children.flatMap((child) => traverse(child, callback))
        }
        return callback(token)
    }

    const appendedTokens: IRToken[] = _.cloneDeep(tokens).flatMap((token) =>
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
