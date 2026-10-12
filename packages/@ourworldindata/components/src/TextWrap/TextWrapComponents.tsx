import * as React from "react"
import { TextWrap } from "./TextWrap"
import { roundForSvg } from "@ourworldindata/utils"

export function TextWrapSvg({
    textWrap,
    x,
    y,
    id,
    ...svgTextProps
}: {
    textWrap: TextWrap
    x: number
    y: number
    id?: string
} & React.SVGProps<SVGTextElement>): React.ReactElement {
    const { lines, fontSize, fontWeight, singleLineHeight, props } = textWrap

    if (lines.length === 0) return <></>

    const [renderX, renderY] = textWrap.getPositionForSvgRendering(x, y)

    return (
        <text
            id={id}
            fontSize={roundForSvg(fontSize)}
            fontWeight={fontWeight}
            x={roundForSvg(renderX)}
            y={roundForSvg(renderY)}
            {...svgTextProps}
        >
            {lines.map((line, i) => {
                const lineX = renderX
                const lineY = renderY + singleLineHeight * i

                if (props.rawHtml)
                    return (
                        <tspan
                            key={i}
                            x={roundForSvg(lineX)}
                            y={roundForSvg(lineY)}
                            dangerouslySetInnerHTML={{ __html: line.text }}
                        />
                    )
                else
                    return (
                        <tspan
                            key={i}
                            x={roundForSvg(lineX)}
                            y={roundForSvg(lineY)}
                        >
                            {line.text}
                        </tspan>
                    )
            })}
        </text>
    )
}

export function TextWrapHtml({
    textWrap,
}: {
    textWrap: TextWrap
}): React.ReactElement | null {
    const { props, lines } = textWrap

    if (lines.length === 0) return null

    return (
        <span>
            {lines.map((line, index) => {
                const content = props.rawHtml ? (
                    <span
                        dangerouslySetInnerHTML={{
                            __html: line.text,
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
