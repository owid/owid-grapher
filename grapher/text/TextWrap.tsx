import { isEmpty, max, stripHTML, linkify } from "grapher/utils/Util"
import { computed } from "mobx"
import { Bounds } from "grapher/utils/Bounds"
import * as React from "react"

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

function startsWithNewline(text: string) {
    return /^\n/.test(text)
}

export class TextWrap {
    props: TextWrapProps
    constructor(props: TextWrapProps) {
        this.props = props
    }

    @computed get maxWidth() {
        return this.props.maxWidth ?? Infinity
    }
    @computed get lineHeight() {
        return this.props.lineHeight ?? 1.1
    }
    @computed get fontSize(): FontSize {
        return this.props.fontSize ?? 1
    }
    @computed get fontWeight() {
        return this.props.fontWeight
    }
    @computed get text() {
        return this.props.text
    }

    @computed get lines() {
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
                lines.push({
                    text: line.join(" "),
                    width: lineBounds.width,
                    height: lineBounds.height,
                })
                line = [word]
                lineBounds = Bounds.forText(word, { fontSize, fontWeight })
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

    @computed get height() {
        return (
            this.lines.reduce((total, line) => total + line.height, 0) +
            this.lineHeight * (this.lines.length - 1)
        )
    }

    @computed get width() {
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

    renderHTML() {
        const { props, lines } = this

        if (lines.length === 0) return null

        // if (props.raw)
        //     return <p style={{ fontSize: fontSize.toFixed(2) + "px", lineHeight: lineHeight, width: this.width }} {...options} dangerouslySetInnerHTML={{__html: text}}/>
        // else
        //     return <p style={{ fontSize: fontSize.toFixed(2) + "px", lineHeight: lineHeight, width: this.width }} {...options}>{strip(text)}</p>

        return (
            <React.Fragment>
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
                        line.text
                    )
                    return (
                        <React.Fragment key={index}>
                            {content}
                            <br />
                        </React.Fragment>
                    )
                })}
            </React.Fragment>
        )
    }

    render(x: number, y: number, options?: any) {
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
