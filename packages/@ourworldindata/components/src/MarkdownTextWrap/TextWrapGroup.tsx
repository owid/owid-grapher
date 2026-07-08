import { CSSProperties } from "react"
import * as R from "remeda"
import {
    Bounds,
    FontFamily,
    imemo,
    omitUndefinedValues,
    VerticalAlign,
    type RequiredBy,
} from "@ourworldindata/utils"
import {
    convertPlaintextToIRTokens,
    getLineWidth,
    IRFontParams,
    IRFragment,
    IRFragmentStyle,
    IRLineBreak,
    IRToken,
    IRWhitespace,
    splitIntoLines,
} from "./IRTokens.js"
import {
    AbstractTokenTextWrap,
    TokenTextWrapOptions,
} from "./AbstractTokenTextWrap.js"
import {
    convertMarkdownToIRTokens,
    normalizeMarkdownNewlines,
} from "./MarkdownTextWrap.js"

/**
 * A single fragment of a TextWrapGroup. The inherited style props act as
 * overrides that fall back to the group-level style when not given.
 */
export interface TextWrapFragment extends IRFragmentStyle {
    text: string

    /** Parse the text as markdown (including details on demand) */
    markdown?: boolean

    /**
     * Placement relative to the preceding content:
     * - "avoid-wrap" places the fragment on the current line if it fits there
     *    in its entirety and on a new line otherwise
     * - "continue-line" continues on the current line unconditionally and lets
     *    the fragment wrap freely
     * - "always" always starts a new line
     */
    newLine?: "avoid-wrap" | "continue-line" | "always"

    /**
     * Horizontal gap between the preceding content and this fragment.
     * Only applies when the fragment is placed inline (continues a line)
     */
    inlineGap?: number

    /**
     * Vertical gap between the preceding line and this fragment.
     * Only applies when the fragment is placed on a new line
     */
    newLineGap?: number
}

type TextWrapGroupProps = {
    fragments: TextWrapFragment[]
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
 * Wraps a sequence of text fragments, each with its own font style, into
 * lines. A fragment is treated as an unbreakable unit where possible: with
 * the default "avoid-wrap" placement it continues on the current line only
 * if it fits there in its entirety, and otherwise starts a new line, where
 * it may wrap internally if it is longer than a full line.
 */
export class TextWrapGroup extends AbstractTokenTextWrap {
    private static readonly defaultOptions = {
        maxWidth: Infinity,
        lineHeight: 1.1,
        verticalAlign: VerticalAlign.bottom,
        detailsOrderedByReference: [] as string[],
    } as const satisfies Partial<TextWrapGroupProps>

    private readonly initialProps: TextWrapGroupProps
    constructor(props: TextWrapGroupProps) {
        super()
        this.initialProps = props
    }

    @imemo get props(): RequiredBy<
        TextWrapGroupProps,
        keyof typeof TextWrapGroup.defaultOptions
    > {
        return { ...TextWrapGroup.defaultOptions, ...this.initialProps }
    }

    protected get options(): TokenTextWrapOptions {
        return this.props
    }

    @imemo get fragments(): TextWrapFragment[] {
        return this.props.fragments.filter(
            (fragment) => fragment.text.trim().length > 0
        )
    }

    @imemo get text(): string {
        return this.fragments.map((fragment) => fragment.text).join(" ")
    }

    private getFragmentFontParams(fragment: TextWrapFragment): IRFontParams {
        return {
            fontFamily: fragment.fontFamily ?? this.fontFamily,
            fontSize: fragment.fontSize ?? this.fontSize,
            fontWeight: fragment.fontWeight ?? this.fontWeight,
        }
    }

    /** Style props in which the fragment differs from the group-level style */
    private getFragmentStyleDelta(fragment: TextWrapFragment): IRFragmentStyle {
        return omitUndefinedValues({
            fontSize:
                fragment.fontSize !== this.fontSize
                    ? fragment.fontSize
                    : undefined,
            fontFamily:
                fragment.fontFamily !== this.fontFamily
                    ? fragment.fontFamily
                    : undefined,
            fontWeight:
                fragment.fontWeight !== this.fontWeight
                    ? fragment.fontWeight
                    : undefined,
            color: fragment.color,
        })
    }

    private makeFragmentElement(
        fragment: TextWrapFragment,
        index: number
    ): IRFragment {
        const fontParams = this.getFragmentFontParams(fragment)
        const children = fragment.markdown
            ? convertMarkdownToIRTokens(
                  normalizeMarkdownNewlines(fragment.text),
                  fontParams
              )
            : convertPlaintextToIRTokens(fragment.text, fontParams)
        return new IRFragment(
            index,
            children,
            this.getFragmentStyleDelta(fragment),
            fontParams
        )
    }

    /** The number of lines each fragment spans */
    @imemo get fragmentLineCounts(): number[] {
        return this.fragments.map(
            (_, index) =>
                this.svgLines.filter((line) =>
                    line.some(
                        (token) =>
                            token instanceof IRFragment &&
                            token.fragmentIndex === index
                    )
                ).length
        )
    }

    @imemo get tokens(): IRToken[] {
        const tokens: IRToken[] = []
        this.fragments.forEach((fragment, index) => {
            const element = this.makeFragmentElement(fragment, index)

            const elementWithGap = (gaps: {
                inlineGap?: number
                lineGap?: number
            }): IRFragment =>
                new IRFragment(
                    index,
                    element.children,
                    element.styleDelta,
                    element.fontParams,
                    gaps.inlineGap,
                    gaps.lineGap
                )

            const pushOnNewLine = (): void => {
                tokens.push(
                    new IRLineBreak(),
                    fragment.newLineGap
                        ? elementWithGap({ lineGap: fragment.newLineGap })
                        : element
                )
            }

            const pushOnCurrentLine = (): void => {
                if (fragment.inlineGap !== undefined) {
                    tokens.push(
                        elementWithGap({ inlineGap: fragment.inlineGap })
                    )
                } else {
                    tokens.push(new IRWhitespace(this.fontParams), element)
                }
            }

            if (index === 0) {
                tokens.push(element)
                return
            }

            const newLine = fragment.newLine ?? "avoid-wrap"
            if (newLine === "always") {
                pushOnNewLine()
                return
            }
            if (newLine === "continue-line") {
                pushOnCurrentLine()
                return
            }

            // "avoid-wrap": place the fragment on the current line only if it
            // fits there in its entirety, otherwise start a new line
            const lines = splitIntoLines(tokens, this.maxWidth)
            const lastLineWidth = getLineWidth(R.last(lines) ?? [])
            const spaceWidth = Bounds.forText(" ", {
                fontSize: this.fontSize,
            }).width
            const gapWidth = fragment.inlineGap ?? spaceWidth
            const availableWidth = this.maxWidth - lastLineWidth - gapWidth
            const fitsOnCurrentLine =
                availableWidth > 0 &&
                splitIntoLines([element], availableWidth).length === 1
            if (fitsOnCurrentLine) {
                pushOnCurrentLine()
            } else {
                pushOnNewLine()
            }
        })

        return tokens
    }
}
