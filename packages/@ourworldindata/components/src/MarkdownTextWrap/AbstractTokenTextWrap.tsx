import * as _ from "lodash-es"
import { CSSProperties } from "react"
import {
    cssFontFamily,
    imemo,
    FontFamily,
    VerticalAlign,
    type RequiredBy,
} from "@ourworldindata/utils"
import * as R from "remeda"
import {
    getTextPositionForSvgRendering,
    type ITextWrap,
} from "../TextWrap/TextWrap.js"
import {
    appendReferenceNumbers,
    getLineFontSize,
    getLineGap,
    lineToPlaintext,
    recursiveMergeTextTokens,
    splitIntoLines,
    type IRFontParams,
    type IRToken,
} from "./IRTokens.js"

export interface TokenTextWrapOptions {
    maxWidth: number
    lineHeight: number
    fontSize: number
    fontWeight?: number
    fontFamily?: FontFamily
    verticalAlign: VerticalAlign
    style?: CSSProperties
    detailsOrderedByReference: string[]
}

export type TokenTextWrapProps = {
    fontSize: number
    maxWidth?: number
    lineHeight?: number
    fontWeight?: number
    fontFamily?: FontFamily
    verticalAlign?: VerticalAlign
    style?: CSSProperties
    detailsOrderedByReference?: string[]
}

/**
 * Base class for text wraps that lay out a stream of IR tokens.
 *
 * Subclasses only provide the token stream (via the abstract `text` and
 * `tokens` getters); this class implements everything downstream of it:
 * - line-splitting against `maxWidth` (`htmlLines`, `svgLines`)
 * - metrics (`width`, `height`, `lineCount`, per-line heights and gaps)
 *
 * Known subclasses: `MarkdownTextWrap` (tokens parsed from a markdown string)
 * and `TextWrapGroup` (tokens assembled from multiple fragments).
 */
export abstract class AbstractTokenTextWrap<
    Props extends TokenTextWrapProps = TokenTextWrapProps,
> implements ITextWrap {
    private static readonly defaultOptions = {
        maxWidth: Infinity,
        lineHeight: 1.1,
        verticalAlign: VerticalAlign.bottom,
        detailsOrderedByReference: [] as string[],
    } as const satisfies Partial<TokenTextWrapProps>

    private readonly initialProps: Props
    constructor(props: Props) {
        this.initialProps = props
    }

    @imemo get props(): RequiredBy<
        Props,
        keyof typeof AbstractTokenTextWrap.defaultOptions
    > {
        return {
            ...AbstractTokenTextWrap.defaultOptions,
            ...this.initialProps,
        }
    }

    protected get options(): TokenTextWrapOptions {
        // The cast is safe since the defaults guarantee that all required
        // options are set, but TS can't verify this for a generic Props
        return this.props as TokenTextWrapOptions
    }

    abstract get text(): string
    abstract get tokens(): IRToken[]

    @imemo get maxWidth(): number {
        return this.options.maxWidth
    }

    @imemo get lineHeight(): number {
        return this.options.lineHeight
    }

    @imemo get fontSize(): number {
        return this.options.fontSize
    }

    @imemo get fontWeight(): number | undefined {
        return this.options.fontWeight
    }

    @imemo get fontFamily(): FontFamily | undefined {
        return this.options.fontFamily
    }

    @imemo get verticalAlign(): VerticalAlign {
        return this.options.verticalAlign
    }

    @imemo get detailsOrderedByReference(): string[] {
        return this.options.detailsOrderedByReference
    }

    @imemo get fontParams(): IRFontParams {
        return {
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
        }
    }

    @imemo get plaintext(): string {
        return this.htmlLines.map(lineToPlaintext).join("\n")
    }

    @imemo get htmlLines(): IRToken[][] {
        const lines = splitIntoLines(this.tokens, this.maxWidth)
        return lines.map((line) =>
            recursiveMergeTextTokens(line, this.fontParams)
        )
    }

    @imemo get svgLines(): IRToken[][] {
        return splitIntoLines(this.tokens, this.maxWidth)
    }

    @imemo get svgLinesWithDodReferenceNumbers(): IRToken[][] {
        const tokensWithReferenceNumbers = appendReferenceNumbers(
            this.tokens,
            this.detailsOrderedByReference
        )
        return splitIntoLines(tokensWithReferenceNumbers, this.maxWidth)
    }

    @imemo get width(): number {
        const { htmlLines } = this
        const lineLengths = htmlLines.map((tokens) =>
            _.sumBy(tokens, (token) => token.width)
        )
        return _.max(lineLengths) ?? 0
    }

    @imemo get singleLineHeight(): number {
        return this.fontSize * this.lineHeight
    }

    @imemo get lastLineWidth(): number {
        return _.sumBy(R.last(this.htmlLines), (token) => token.width) ?? 0
    }

    @imemo get lineCount(): number {
        return this.htmlLines.length
    }

    getLineHeight(line: IRToken[]): number {
        return (getLineFontSize(line) ?? this.fontSize) * this.lineHeight
    }

    /** Per-line line heights */
    @imemo get lineHeights(): number[] {
        return this.htmlLines.map((line) => this.getLineHeight(line))
    }

    /** Extra vertical space above each line */
    @imemo get lineGaps(): number[] {
        return this.htmlLines.map((line) => getLineGap(line))
    }

    @imemo get height(): number {
        return _.sum(this.lineHeights) + _.sum(this.lineGaps)
    }

    @imemo get style(): CSSProperties {
        return {
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            fontFamily: this.fontFamily
                ? cssFontFamily(this.fontFamily)
                : undefined,
            ...this.options.style,
            lineHeight: this.lineHeight,
        }
    }

    getPositionForSvgRendering(x: number, y: number): [number, number] {
        return getTextPositionForSvgRendering(this, x, y)
    }
}
