import * as React from "react"
import { computed } from "mobx"
import { TextWrap } from "./TextWrap"
import { splitIntoFragments } from "./TextWrapUtils"
import { Bounds, last, max } from "@ourworldindata/utils"
import { Halo } from "../Halo/Halo"

interface TextWrapFragment {
    text: string
    fontWeight?: number
    // specifies the wrapping behavior of the fragment (only applies to the
    // second, third,... fragments but not the first one)
    // - "continue-line" places the fragment in the same line if possible (default)
    // - "always" places the fragment in a new line in all cases
    // - "avoid-wrap" places the fragment in a new line only if the fragment would wrap otherwise
    newLine?: "continue-line" | "always" | "avoid-wrap"
}

interface PlacedTextWrap {
    textWrap: TextWrap
    yOffset: number
}

interface TextWrapGroupProps {
    fragments: TextWrapFragment[]
    maxWidth: number
    lineHeight?: number
    fontSize: number
    fontWeight?: number
}

export class TextWrapGroup {
    props: TextWrapGroupProps
    constructor(props: TextWrapGroupProps) {
        this.props = props
    }

    @computed get lineHeight(): number {
        return this.props.lineHeight ?? 1.1
    }

    @computed get fontSize(): number {
        return this.props.fontSize
    }

    @computed get fontWeight(): number | undefined {
        return this.props.fontWeight
    }

    @computed get text(): string {
        return this.props.fragments.map((fragment) => fragment.text).join(" ")
    }

    @computed get maxWidth(): number {
        const wordWidths = this.props.fragments.flatMap((fragment) =>
            splitIntoFragments(fragment.text).map(
                ({ text }) =>
                    Bounds.forText(text, {
                        fontSize: this.fontSize,
                        fontWeight: fragment.fontWeight ?? this.fontWeight,
                    }).width
            )
        )
        return max([...wordWidths, this.props.maxWidth]) ?? Infinity
    }

    private makeTextWrapForFragment(
        fragment: TextWrapFragment,
        offset = 0
    ): TextWrap {
        return new TextWrap({
            text: fragment.text,
            maxWidth: this.maxWidth,
            lineHeight: this.lineHeight,
            fontSize: this.fontSize,
            fontWeight: fragment.fontWeight ?? this.fontWeight,
            firstLineOffset: offset,
        })
    }

    @computed private get whitespaceWidth(): number {
        return Bounds.forText(" ", { fontSize: this.fontSize }).width
    }

    private getOffsetOfNextTextWrap(textWrap: TextWrap): number {
        return textWrap.lastLineWidth + this.whitespaceWidth
    }

    private placeTextWrapIntoNewLine(
        fragment: TextWrapFragment,
        previousPlacedTextWrap: PlacedTextWrap
    ): PlacedTextWrap {
        const { textWrap: lastTextWrap, yOffset: lastYOffset } =
            previousPlacedTextWrap

        const textWrap = this.makeTextWrapForFragment(fragment)
        const yOffset = lastYOffset + lastTextWrap.height

        return { textWrap, yOffset }
    }

    private placeTextWrapIntoTheSameLine(
        fragment: TextWrapFragment,
        previousPlacedTextWrap: PlacedTextWrap
    ): PlacedTextWrap {
        const { textWrap: lastTextWrap, yOffset: lastYOffset } =
            previousPlacedTextWrap

        const xOffset = this.getOffsetOfNextTextWrap(lastTextWrap)
        const textWrap = this.makeTextWrapForFragment(fragment, xOffset)

        // if the text wrap is placed in the same line, we need to
        // be careful not to double count the height of the first line
        const heightWithoutFirstLine =
            (lastTextWrap.lineCount - 1) * lastTextWrap.singleLineHeight
        const yOffset = lastYOffset + heightWithoutFirstLine

        return { textWrap, yOffset }
    }

    private placeTextWrapIntoTheSameLineIfNotWrapping(
        fragment: TextWrapFragment,
        previousPlacedTextWrap: PlacedTextWrap
    ): PlacedTextWrap {
        const { textWrap: lastTextWrap } = previousPlacedTextWrap

        // try to place text wrap in the same line with the given offset
        const xOffset = this.getOffsetOfNextTextWrap(lastTextWrap)
        const textWrap = this.makeTextWrapForFragment(fragment, xOffset)

        const lineCount = textWrap.lines.filter((text) => text).length
        if (lineCount > 1) {
            // if the text is wrapping, break into a new line instead
            return this.placeTextWrapIntoNewLine(
                fragment,
                previousPlacedTextWrap
            )
        } else {
            // else, place the text wrap in the same line
            return this.placeTextWrapIntoTheSameLine(
                fragment,
                previousPlacedTextWrap
            )
        }
    }

    private placeTextWrap(
        fragment: TextWrapFragment,
        previousPlacedTextWrap: PlacedTextWrap
    ): PlacedTextWrap {
        const newLine = fragment.newLine ?? "continue-line"
        switch (newLine) {
            case "always":
                return this.placeTextWrapIntoNewLine(
                    fragment,
                    previousPlacedTextWrap
                )
            case "continue-line":
                return this.placeTextWrapIntoTheSameLine(
                    fragment,
                    previousPlacedTextWrap
                )
            case "avoid-wrap":
                return this.placeTextWrapIntoTheSameLineIfNotWrapping(
                    fragment,
                    previousPlacedTextWrap
                )
        }
    }

    @computed get placedTextWraps(): PlacedTextWrap[] {
        const { fragments } = this.props
        if (fragments.length === 0) return []

        const firstTextWrap = this.makeTextWrapForFragment(fragments[0])
        const textWraps: PlacedTextWrap[] = [
            { textWrap: firstTextWrap, yOffset: 0 },
        ]

        for (let i = 1; i < fragments.length; i++) {
            const fragment = fragments[i]
            const previousPlacedTextWrap = textWraps[i - 1]
            textWraps.push(this.placeTextWrap(fragment, previousPlacedTextWrap))
        }

        return textWraps
    }

    @computed get textWraps(): TextWrap[] {
        return this.placedTextWraps.map(({ textWrap }) => textWrap)
    }

    @computed get height(): number {
        if (this.placedTextWraps.length === 0) return 0
        const { textWrap, yOffset } = last(this.placedTextWraps)!
        return yOffset + textWrap.height
    }

    @computed get singleLineHeight(): number {
        if (this.textWraps.length === 0) return 0
        return this.textWraps[0].singleLineHeight
    }

    @computed get width(): number {
        return max(this.textWraps.map((textWrap) => textWrap.width)) ?? 0
    }

    // split concatenated fragments into lines for rendering. a line may have
    // multiple fragments since each fragment comes with its own style and
    // is therefore rendered into a separate tspan.
    @computed get lines(): {
        fragments: { text: string; textWrap: TextWrap }[]
        yOffset: number
    }[] {
        const lines = []
        for (const { textWrap, yOffset } of this.placedTextWraps) {
            for (let i = 0; i < textWrap.lineCount; i++) {
                const line = textWrap.lines[i]
                const isFirstLineInTextWrap = i === 0

                // don't render empty lines
                if (!line.text) continue

                const fragment = {
                    text: line.text,
                    textWrap,
                }

                const lastLine = last(lines)
                if (
                    isFirstLineInTextWrap &&
                    textWrap.firstLineOffset > 0 &&
                    lastLine
                ) {
                    // if the current line is offset, add it to the previous line
                    lastLine.fragments.push(fragment)
                } else {
                    // else, push a new line
                    lines.push({
                        fragments: [fragment],
                        yOffset: yOffset + i * textWrap.singleLineHeight,
                    })
                }
            }
        }

        return lines
    }

    render(
        x: number,
        y: number,
        {
            showTextOutline,
            textOutlineColor,
            textProps,
        }: {
            showTextOutline?: boolean
            textOutlineColor?: string
            textProps?: React.SVGProps<SVGTextElement>
        } = {}
    ): React.ReactElement {
        // Alternatively, we could render each TextWrap one by one. That would
        // give us a good but not pixel-perfect result since the text
        // measurements are not 100% accurate. To avoid inconsistent spacing
        // between text wraps, we split the text into lines and render
        // the different styles as tspans within the same text element.
        return (
            <>
                {this.lines.map((line) => {
                    const key = line.yOffset.toString()
                    const [textX, textY] =
                        line.fragments[0].textWrap.getPositionForSvgRendering(
                            x,
                            y
                        )
                    return (
                        <Halo
                            id={key}
                            key={key}
                            show={showTextOutline}
                            outlineColor={textOutlineColor}
                        >
                            <text
                                x={textX}
                                y={textY + line.yOffset}
                                fontSize={this.fontSize.toFixed(2)}
                                {...textProps}
                            >
                                {line.fragments.map((fragment, index) => (
                                    <tspan
                                        key={index}
                                        fontWeight={
                                            fragment.textWrap.fontWeight
                                        }
                                    >
                                        {index === 0 ? "" : " "}
                                        {fragment.text}
                                    </tspan>
                                ))}
                            </text>
                        </Halo>
                    )
                })}
            </>
        )
    }
}
