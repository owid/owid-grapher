import * as React from "react"
import { makeFigmaId } from "@ourworldindata/utils"
import { TextWrapSvg } from "@ourworldindata/components"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { Emphasis } from "../interaction/Emphasis"
import {
    BinEmphasis,
    LegendStyleConfig,
    resolveLegendMarkerStyle,
    resolveLegendTextStyle,
} from "./LegendStyleConfig"
import { VerticalColorLegendState } from "./VerticalColorLegendState"

interface VerticalColorLegendProps {
    state: VerticalColorLegendState
    x: number
    y: number
    binEmphasis?: BinEmphasis
    styleConfig?: LegendStyleConfig
    onMouseOver?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onClick?: (bin: ColorScaleBin) => void
    isStatic?: boolean
}

export function VerticalColorLegend(
    props: VerticalColorLegendProps
): React.ReactElement {
    const {
        state,
        x,
        y,
        binEmphasis,
        styleConfig,
        onMouseOver,
        onMouseLeave,
        onClick,
        isStatic,
    } = props
    const { series, rectSize, rectPadding, lineHeight, title } = state

    const emphasisFor = (bin: ColorScaleBin): Emphasis =>
        binEmphasis?.get(bin) ?? Emphasis.Default

    return (
        <g
            id={makeFigmaId("vertical-color-legend")}
            className="ScatterColorLegend clickable"
        >
            {title && (
                <TextWrapSvg textWrap={title} x={x} y={y} fontWeight={700} />
            )}
            <g id={makeFigmaId("labels")}>
                {series.map((series) => {
                    const style = resolveLegendTextStyle(
                        styleConfig,
                        emphasisFor(series.bin)
                    )

                    const textX = x + rectSize + rectPadding
                    const textY = y + series.yOffset

                    return (
                        <React.Fragment key={series.textWrap.text}>
                            <TextWrapSvg
                                textWrap={series.textWrap}
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
                {series.map((series) => {
                    const style = resolveLegendMarkerStyle(
                        styleConfig,
                        emphasisFor(series.bin),
                        { fill: series.bin.color }
                    )

                    const textX = x + rectSize + rectPadding
                    const textY = y + series.yOffset
                    const renderedTextPosition =
                        series.textWrap.getPositionForSvgRendering(textX, textY)

                    return (
                        <rect
                            id={makeFigmaId(series.textWrap.text)}
                            key={series.textWrap.text}
                            x={x}
                            y={renderedTextPosition[1] - rectSize}
                            width={rectSize}
                            height={rectSize}
                            style={style}
                        />
                    )
                })}
            </g>
            {!isStatic && (
                <g>
                    {series.map((series) => {
                        const label = series.textWrap.text
                        const mouseOver = onMouseOver
                            ? (): void => onMouseOver(series.bin)
                            : undefined
                        const mouseLeave = onMouseLeave || undefined
                        const click = onClick
                            ? (): void => onClick(series.bin)
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
                                    x={x}
                                    y={y + series.yOffset - lineHeight / 2}
                                    width={series.width}
                                    height={series.height + lineHeight}
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
}
