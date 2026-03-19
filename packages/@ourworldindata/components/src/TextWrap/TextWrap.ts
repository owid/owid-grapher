import * as _ from "lodash-es"
import * as R from "remeda"
import {
    stripHTML,
    Bounds,
    FontFamily,
    VerticalAlign,
    imemo,
    type RequiredBy,
} from "@ourworldindata/utils"
import { Fragment, joinFragments, splitIntoFragments } from "./TextWrapUtils"
import { match } from "ts-pattern"

declare type FontSize = number

interface TextWrapOptions {
    maxWidth: number
    lineHeight?: number
    fontSize: FontSize
    fontWeight?: number
    fontFamily?: FontFamily
    separators?: string[]
    rawHtml?: boolean
    verticalAlign?: VerticalAlign
}

type TextWrapProps = { text: string } & TextWrapOptions

interface WrapLine {
    text: string
    width: number
    height: number
}

interface OpenHtmlTag {
    tag: string // e.g. "a" for an <a> tag, or "span" for a <span> tag
    fullTag: string // e.g. "<a href='https://ourworldindata.org'>"
}

const HTML_OPENING_CLOSING_TAG_REGEX = /<(\/?)([A-Za-z]+)( [^<>]*)?>/g

function startsWithNewline(text: string): boolean {
    return text.startsWith("\n")
}

/**
 * Shortens text to fit within a target width using binary search.
 * Returns the longest substring that fits within the target width.
 */
export const shortenForTargetWidth = (
    text: string,
    targetWidth: number,
    fontSettings: {
        fontSize?: number
        fontWeight?: number
        fontFamily?: FontFamily
    } = {}
): string => {
    // Use binary search to find the largest substring that fits within the target width
    let low = 0
    let high = text.length
    while (low <= high) {
        const mid = (high + low) >> 1
        const bounds = Bounds.forText(text.slice(0, mid), fontSettings)
        if (bounds.width < targetWidth) {
            low = mid + 1
        } else {
            high = mid - 1
        }
    }
    return text.slice(0, low - 1)
}

/** Shortens text to fit within the target width and appends an ellipsis (…) */
export const shortenWithEllipsis = (
    text: string,
    targetWidth: number,
    fontSettings: {
        fontSize?: number
        fontWeight?: number
        fontFamily?: FontFamily
    } = {}
): string => {
    const ellipsis = "…"
    const ellipsisWidth = Bounds.forText(ellipsis, fontSettings).width
    const truncatedText = shortenForTargetWidth(
        text,
        targetWidth - ellipsisWidth,
        fontSettings
    )
    return `${truncatedText}${ellipsis}`
}

export interface ITextWrap {
    readonly width: number
    readonly height: number
    readonly lastLineWidth: number
    readonly singleLineHeight: number
    readonly maxWidth: number
    readonly fontSize: number
    readonly fontWeight: number | undefined
    readonly fontFamily: FontFamily | undefined
    readonly lineHeight: number
    readonly text: string
    getPositionForSvgRendering(x: number, y: number): [number, number]
}

export class TextWrap implements ITextWrap {
    private static defaultOptions = {
        maxWidth: Infinity,
        lineHeight: 1.1,
        separators: [" "],
        verticalAlign: VerticalAlign.bottom,
    } as const satisfies Partial<TextWrapProps>

    private initialProps: TextWrapProps
    constructor(props: TextWrapProps) {
        this.initialProps = props
    }

    @imemo get props(): RequiredBy<
        TextWrapProps,
        keyof typeof TextWrap.defaultOptions
    > {
        return { ...TextWrap.defaultOptions, ...this.initialProps }
    }

    @imemo get maxWidth(): number {
        return this.props.maxWidth
    }
    @imemo get lineHeight(): number {
        return this.props.lineHeight
    }
    @imemo get fontSize(): FontSize {
        return this.props.fontSize
    }
    @imemo get fontWeight(): number | undefined {
        return this.props.fontWeight
    }
    @imemo get fontFamily(): FontFamily | undefined {
        return this.props.fontFamily
    }
    @imemo get verticalAlign(): VerticalAlign {
        return this.props.verticalAlign
    }
    @imemo get text(): string {
        return this.props.text
    }
    @imemo get separators(): string[] {
        return this.props.separators
    }

    // We need to take care that HTML tags are not split across lines.
    // Instead, we want every line to have opening and closing tags for all tags that appear.
    // This is so we don't produce invalid HTML.
    processHtmlTags(lines: WrapLine[]): WrapLine[] {
        const currentlyOpenTags: OpenHtmlTag[] = []
        for (const line of lines) {
            // Prepend any still-open tags to the start of the line
            const prependOpenTags = currentlyOpenTags
                .map((t) => t.fullTag)
                .join("")

            const tagMatches = line.text.matchAll(
                HTML_OPENING_CLOSING_TAG_REGEX
            )
            for (const tag of tagMatches) {
                const isOpeningTag = tag[1] !== "/"
                if (isOpeningTag) {
                    currentlyOpenTags.push({
                        tag: tag[2],
                        fullTag: tag[0],
                    })
                } else {
                    if (
                        !currentlyOpenTags.length ||
                        currentlyOpenTags.at(-1)?.tag !== tag[2]
                    ) {
                        throw new Error(
                            "TextWrap: Opening and closing HTML tags do not match"
                        )
                    }
                    currentlyOpenTags.pop()
                }
            }

            // Append any unclosed tags to the end of the line
            const appendCloseTags = currentlyOpenTags
                .toReversed()
                .map((t) => `</${t.tag}>`)
                .join("")
            line.text = prependOpenTags + line.text + appendCloseTags
        }
        return lines
    }

    @imemo get lines(): WrapLine[] {
        const { text, separators, maxWidth, fontSize, fontWeight, fontFamily } =
            this

        // Prepend spaces so that the string is also split before newline characters
        // See startsWithNewline
        const fragments = splitIntoFragments(
            text.replace(/\n/g, " \n"),
            separators
        )

        const lines: WrapLine[] = []

        let line: Fragment[] = []
        let lineBounds = Bounds.empty()

        fragments.forEach((fragment) => {
            const nextLine = line.concat([fragment])

            // Strip HTML if a raw string is passed
            const text = this.props.rawHtml
                ? stripHTML(joinFragments(nextLine))
                : joinFragments(nextLine)

            const nextBounds = Bounds.forText(text, {
                fontSize,
                fontWeight,
                fontFamily,
            })

            if (
                startsWithNewline(fragment.text) ||
                (nextBounds.width + 10 > maxWidth && line.length >= 1)
            ) {
                // Introduce a newline _before_ this word
                lines.push({
                    text: joinFragments(line),
                    width: lineBounds.width,
                    height: lineBounds.height,
                })
                // ... and start a new line with this word (with a potential leading newline stripped)
                const wordWithoutNewline = fragment.text.replace(/^\n/, "")
                line = [
                    {
                        text: wordWithoutNewline,
                        separator: fragment.separator,
                    },
                ]
                lineBounds = Bounds.forText(wordWithoutNewline, {
                    fontSize,
                    fontWeight,
                    fontFamily,
                })
            } else {
                line = nextLine
                lineBounds = nextBounds
            }
        })

        // Push the last line
        if (line.length > 0)
            lines.push({
                text: joinFragments(line),
                width: lineBounds.width,
                height: lineBounds.height,
            })

        // Process HTML to ensure that each opening tag has a matching closing tag _in each line_
        if (this.props.rawHtml) return this.processHtmlTags(lines)
        else return lines
    }

    @imemo get lineCount(): number {
        return this.lines.length
    }

    @imemo get singleLineHeight(): number {
        return this.fontSize * this.lineHeight
    }

    @imemo get height(): number {
        if (this.lineCount === 0) return 0
        return this.lineCount * this.singleLineHeight
    }

    @imemo get width(): number {
        return _.max(this.lines.map((l) => l.width)) ?? 0
    }

    @imemo get lastLineWidth(): number {
        return R.last(this.lines)?.width ?? 0
    }

    @imemo get htmlStyle(): any {
        const { fontSize, fontWeight, lineHeight } = this
        return {
            fontSize: fontSize.toFixed(2) + "px",
            fontWeight: fontWeight,
            lineHeight: lineHeight,
            overflowY: "visible",
        }
    }

    getPositionForSvgRendering(x: number, y: number): [number, number] {
        const { lines, fontSize, lineHeight, height, verticalAlign } = this

        // Magic number set through experimentation.
        // The HTML and SVG renderers need to position lines identically.
        // This number was tweaked until the overlaid HTML and SVG outputs
        // overlap.
        const HEIGHT_CORRECTION_FACTOR = 0.74

        const textHeight = _.max(lines.map((line) => line.height)) ?? 0
        const correctedTextHeight = textHeight * HEIGHT_CORRECTION_FACTOR
        const containerHeight = lineHeight * fontSize
        const correctedY =
            y + (containerHeight - (containerHeight - correctedTextHeight) / 2)

        const renderY = match(verticalAlign)
            .with(VerticalAlign.top, () => correctedY - height)
            .with(VerticalAlign.middle, () => correctedY - height / 2)
            .with(VerticalAlign.bottom, () => correctedY)
            .exhaustive()

        return [x, renderY]
    }
}
