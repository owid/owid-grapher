import { isEmpty, max, stripHTML, linkify } from "../../clientUtils/Util.js"
import { computed } from "mobx"
import { Bounds } from "../../clientUtils/Bounds.js"
import React from "react"

declare type FontSize = number

interface TextWrapProps {
    text: string
    maxWidth: number
    lineHeight?: number
    fontSize: FontSize
    fontWeight?: number
    rawHtml?: boolean
    /** Wrap URL-like text in <a> tag. Only works when rendering HTML. */
    linkifyText?: boolean
}

interface WrapLine {
    text: string
    width: number
    height: number
}

function startsWithNewline(text: string): boolean {
    return /^\n/.test(text)
}

export const shortenForTargetWidth = (
    text: string,
    targetWidth: number,
    fontSettings: {
        fontSize?: number
        fontWeight?: number
        fontFamily?: string
    } = {}
): string => {
    // use binary search to find the largest substring that fits within the target width
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

export class TextWrap {
    props: TextWrapProps
    constructor(props: TextWrapProps) {
        this.props = props
    }

    @computed get maxWidth(): number {
        return this.props.maxWidth ?? Infinity
    }
    @computed get lineHeight(): number {
        return this.props.lineHeight ?? 1.1
    }
    @computed get fontSize(): FontSize {
        return this.props.fontSize ?? 1
    }
    @computed get fontWeight(): number | undefined {
        return this.props.fontWeight
    }
    @computed get text(): string {
        return this.props.text
    }

    @computed get lines(): WrapLine[] {
        const { text, maxWidth, fontSize, fontWeight } = this

        const words = isEmpty(text)
            ? []
            : // We prepend spaces to newlines in order to be able to do a "starts with"
              // check to trigger a new line.
              text.replace(/\n/g, " \n").split(" ")

        const lines: WrapLine[] = []

        let line: string[] = []
        let lineBounds = Bounds.empty()

        words.forEach((word) => {
            const nextLine = line.concat([word])

            // Strip HTML if a raw string is passed
            const text = this.props.rawHtml
                ? stripHTML(nextLine.join(" "))
                : nextLine.join(" ")

            const nextBounds = Bounds.forText(text, {
                fontSize,
                fontWeight,
            })

            if (
                startsWithNewline(word) ||
                (nextBounds.width + 10 > maxWidth && line.length >= 1)
            ) {
                const wordWithoutNewline = word.replace(/^\n/, "")
                lines.push({
                    text: line.join(" "),
                    width: lineBounds.width,
                    height: lineBounds.height,
                })
                line = [wordWithoutNewline]
                lineBounds = Bounds.forText(wordWithoutNewline, {
                    fontSize,
                    fontWeight,
                })
            } else {
                line = nextLine
                lineBounds = nextBounds
            }
        })
        if (line.length > 0)
            lines.push({
                text: line.join(" "),
                width: lineBounds.width,
                height: lineBounds.height,
            })

        return lines
    }

    @computed get height(): number {
        if (this.lines.length === 0) return 0

        return (
            this.lines.reduce((total, line) => total + line.height, 0) +
            this.lineHeight * (this.lines.length - 1)
        )
    }

    @computed get width(): number {
        return max(this.lines.map((l) => l.width)) ?? 0
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

    renderHTML(): JSX.Element | null {
        const { props, lines } = this

        if (lines.length === 0) return null

        // if (props.raw)
        //     return <p style={{ fontSize: fontSize.toFixed(2) + "px", lineHeight: lineHeight, width: this.width }} {...options} dangerouslySetInnerHTML={{__html: text}}/>
        // else
        //     return <p style={{ fontSize: fontSize.toFixed(2) + "px", lineHeight: lineHeight, width: this.width }} {...options}>{strip(text)}</p>

        return (
            <span>
                {lines.map((line, index) => {
                    const content = props.rawHtml ? (
                        <span
                            dangerouslySetInnerHTML={{
                                __html: line.text,
                            }}
                        />
                    ) : props.linkifyText ? (
                        <span
                            dangerouslySetInnerHTML={{
                                __html: linkify(line.text),
                            }}
                        />
                    ) : (
                        <span>{line.text}</span>
                    )
                    return (
                        <React.Fragment key={index}>
                            {content}
                            <br />
                        </React.Fragment>
                    )
                })}
            </span>
        )
    }

    render(
        x: number,
        y: number,
        options?: React.SVGProps<SVGTextElement>
    ): JSX.Element | null {
        //React.SVGAttributes<SVGTextElement>) {
        const { props, lines, fontSize, fontWeight, lineHeight } = this

        if (lines.length === 0) return null

        const yOffset = y + lines[0].height - lines[0].height * 0.2
        return (
            <text
                fontSize={fontSize.toFixed(2)}
                fontWeight={fontWeight}
                x={x.toFixed(1)}
                y={yOffset.toFixed(1)}
                {...options}
            >
                {lines.map((line, i) => {
                    if (props.rawHtml)
                        return (
                            <tspan
                                key={i}
                                x={x}
                                y={
                                    yOffset +
                                    (i === 0 ? 0 : lineHeight * fontSize * i)
                                }
                                dangerouslySetInnerHTML={{ __html: line.text }}
                            />
                        )
                    else
                        return (
                            <tspan
                                key={i}
                                x={x}
                                y={
                                    yOffset +
                                    (i === 0 ? 0 : lineHeight * fontSize * i)
                                }
                            >
                                {line.text}
                            </tspan>
                        )
                })}
            </text>
        )
    }
}
