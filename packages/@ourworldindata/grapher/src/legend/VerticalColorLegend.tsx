import * as React from "react"
import { makeFigmaId } from "@ourworldindata/utils"
import { TextWrapSvg } from "@ourworldindata/components"
import { ColorScaleBin } from "../color/ColorScaleBin"
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
    interactive?: boolean
    styleConfig?: LegendStyleConfig
    binEmphasis?: BinEmphasis
    onMouseOver?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onClick?: (bin: ColorScaleBin) => void
}

export function VerticalColorLegend(
    props: VerticalColorLegendProps
): React.ReactElement {
    const {
        state,
        x,
        y,
        interactive = true,
        styleConfig,
        binEmphasis,
        onMouseOver,
        onMouseLeave,
        onClick,
    } = props
    const { series, title } = state

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
                        binEmphasis?.get(series.bin)
                    )

                    return (
                        <TextWrapSvg
                            key={series.textWrap.text}
                            textWrap={series.textWrap}
                            x={x + series.label.x}
                            y={y + series.label.y}
                            fill={style.color}
                            {...style}
                        />
                    )
                })}
            </g>
            <g id={makeFigmaId("swatches")}>
                {series.map((series) => {
                    const style = resolveLegendMarkerStyle(
                        styleConfig,
                        binEmphasis?.get(series.bin),
                        { fill: series.bin.color }
                    )

                    return (
                        <rect
                            id={makeFigmaId(series.textWrap.text)}
                            key={series.textWrap.text}
                            x={x + series.swatch.x}
                            y={y + series.swatch.y}
                            width={series.swatch.width}
                            height={series.swatch.height}
                            style={style}
                        />
                    )
                })}
            </g>
            {interactive && (
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
                                    x={x + series.hitArea.x}
                                    y={y + series.hitArea.y}
                                    width={series.hitArea.width}
                                    height={series.hitArea.height}
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
