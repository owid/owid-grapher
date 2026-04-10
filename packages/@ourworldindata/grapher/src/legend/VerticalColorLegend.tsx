import * as React from "react"
import { observer } from "mobx-react"
import { makeFigmaId } from "@ourworldindata/utils"
import { TextWrapSvg } from "@ourworldindata/components"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { VerticalColorLegendState } from "./VerticalColorLegendState"
import { roundPixel } from "../chart/ChartUtils"

interface VerticalColorLegendProps {
    state: VerticalColorLegendState
    x: number
    y: number
    onMouseOver?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onClick?: (bin: ColorScaleBin) => void
    isStatic?: boolean
}

export const VerticalColorLegend = observer(function VerticalColorLegend({
    state,
    x,
    y,
    onMouseOver,
    onMouseLeave,
    onClick,
    isStatic,
}: VerticalColorLegendProps): React.ReactElement {
    const { series, rectSize, rectPadding, lineHeight, title } = state

    return (
        <g
            id={makeFigmaId("vertical-color-legend")}
            className="ScatterColorLegend clickable"
        >
            {title && (
                <TextWrapSvg textWrap={title} x={x} y={y} fontWeight={700} />
            )}
            <g id={makeFigmaId("labels")}>
                {series.map((s) => {
                    const style = state.getTextStyleConfig(s.bin)
                    const textX = x + rectSize + rectPadding
                    const textY = y + s.yOffset

                    return (
                        <React.Fragment key={s.textWrap.text}>
                            <TextWrapSvg
                                textWrap={s.textWrap}
                                x={textX}
                                y={textY}
                                fill={style.color}
                                {...style}
                            />
                        </React.Fragment>
                    )
                })}
            </g>
            <g id={makeFigmaId("swatches")}>
                {series.map((s) => {
                    const style = state.getMarkerStyleConfig(s.bin)
                    const textX = x + rectSize + rectPadding
                    const textY = y + s.yOffset
                    const renderedTextPosition =
                        s.textWrap.getPositionForSvgRendering(textX, textY)

                    return (
                        <rect
                            id={makeFigmaId(s.textWrap.text)}
                            key={s.textWrap.text}
                            x={roundPixel(x)}
                            y={roundPixel(renderedTextPosition[1] - rectSize)}
                            width={roundPixel(rectSize)}
                            height={roundPixel(rectSize)}
                            style={style}
                        />
                    )
                })}
            </g>
            {!isStatic && (
                <g>
                    {series.map((s) => {
                        const label = s.textWrap.text
                        const mouseOver = onMouseOver
                            ? (): void => onMouseOver(s.bin)
                            : undefined
                        const mouseLeave = onMouseLeave || undefined
                        const click = onClick
                            ? (): void => onClick(s.bin)
                            : undefined
                        const cursor = click ? "pointer" : "default"

                        return (
                            <g
                                key={label}
                                className="legendMark"
                                onMouseOver={mouseOver}
                                onMouseLeave={mouseLeave}
                                onClick={click}
                                style={{ cursor }}
                            >
                                <rect
                                    x={roundPixel(x)}
                                    y={roundPixel(
                                        y + s.yOffset - lineHeight / 2
                                    )}
                                    width={roundPixel(s.width)}
                                    height={roundPixel(s.height + lineHeight)}
                                    fill="#fff"
                                    fillOpacity={0}
                                />
                            </g>
                        )
                    })}
                </g>
            )}
        </g>
    )
})
