import React from "react"
import { computed } from "mobx"
import { TextWrap } from "./TextWrap"
import { splitIntoFragments } from "./TextWrapUtils"
import { Bounds, last, max } from "@ourworldindata/utils"

interface TextWrapFragment {
    text: string
    fontWeight?: number
    preferLineBreakOverWrapping?: boolean
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

    @computed get placedTextWraps(): PlacedTextWrap[] {
        const { fragments } = this.props
        if (fragments.length === 0) return []

        const whitespaceWidth = Bounds.forText(" ", {
            fontSize: this.fontSize,
        }).width

        const textWraps: PlacedTextWrap[] = [
            {
                textWrap: this.makeTextWrapForFragment(fragments[0]),
                yOffset: 0,
            },
        ]

        for (let i = 1; i < fragments.length; i++) {
            const fragment = fragments[i]
            const { textWrap: lastTextWrap, yOffset: lastYOffset } =
                textWraps[i - 1]

            let textWrap = this.makeTextWrapForFragment(
                fragment,
                lastTextWrap.lastLineWidth + whitespaceWidth
            )

            let yOffset = lastYOffset
            if (textWrap.firstLineOffset === 0) {
                yOffset += lastTextWrap.height
            } else {
                yOffset +=
                    (lastTextWrap.lineCount - 1) * lastTextWrap.singleLineHeight
            }

            // some fragments are preferred to break into a new line
            // instead of being wrapped
            if (
                fragment.preferLineBreakOverWrapping &&
                textWrap.lineCount > 1
            ) {
                textWrap = this.makeTextWrapForFragment(fragment)
                yOffset += lastTextWrap.singleLineHeight
            }

            textWraps.push({ textWrap, yOffset })
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

    @computed get lines(): {
        fragments: Omit<TextWrapFragment, "preferLineBreakOverWrapping">[]
        textWrap: TextWrap
        yOffset: number
    }[] {
        const lines = []
        for (const { textWrap, yOffset } of this.placedTextWraps) {
            for (let i = 0; i < textWrap.lineCount; i++) {
                const textWrapLine = textWrap.lines[i]
                const isFirstTextWrapLine = i === 0

                const fragment = {
                    textWrap,
                    text: textWrapLine.text,
                    fontWeight: textWrap.fontWeight,
                }

                const lastLine = last(lines)
                if (
                    textWrap.firstLineOffset > 0 &&
                    isFirstTextWrapLine &&
                    lastLine
                ) {
                    // if the current line is offsetted, add it to the previous line
                    lastLine.fragments.push(fragment)
                } else {
                    // else, push a new line
                    lines.push({
                        textWrap,
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
            textProps,
            id,
        }: { textProps?: React.SVGProps<SVGTextElement>; id?: string } = {}
    ): React.ReactElement {
        // Alternatively, we could render each TextWrap one by one. That would
        // give us a good but not pixel-perfect result since the text
        // measurements are not 100% accurate. To avoid inconsistent spacing
        // between text wraps, we split the text into lines and render
        // the different styles as tspans within the same text element.
        return (
            <g id={id}>
                {this.lines.map((line) => {
                    const [textX, textY] =
                        line.textWrap.getPositionForSvgRendering(x, y)
                    return (
                        <text
                            key={line.yOffset.toString()}
                            x={textX}
                            y={textY + line.yOffset}
                            fontSize={this.fontSize.toFixed(2)}
                            {...textProps}
                        >
                            {line.fragments.map((fragment, index) => (
                                <tspan
                                    key={index}
                                    fontWeight={fragment.fontWeight}
                                >
                                    {index === 0 ? "" : " "}
                                    {fragment.text}
                                </tspan>
                            ))}
                        </text>
                    )
                })}
            </g>
        )
    }
}
