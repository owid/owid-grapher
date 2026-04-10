import * as _ from "lodash-es"
import * as React from "react"
import { observer } from "mobx-react"
import {
    dyFromAlign,
    removeAllWhitespace,
    makeFigmaId,
    VerticalAlign,
} from "@ourworldindata/utils"
import { TextWrapSvg } from "@ourworldindata/components"
import { ColorScaleBin, NumericBin } from "../color/ColorScaleBin"
import { darkenColorForLine } from "../color/ColorUtils"
import { HorizontalNumericColorLegendState } from "./HorizontalNumericColorLegendState"
import { ARROW_SIZE } from "./HorizontalColorLegendConstants"
import { roundPixel } from "../chart/ChartUtils"

interface HorizontalNumericColorLegendProps {
    state: HorizontalNumericColorLegendState
    x: number
    y: number
    onMouseEnter?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onMouseOver?: (bin: ColorScaleBin) => void
}

export const HorizontalNumericColorLegend = observer(
    function HorizontalNumericColorLegend({
        state,
        x,
        y,
        onMouseEnter,
        onMouseLeave,
        onMouseOver,
    }: HorizontalNumericColorLegendProps): React.ReactElement {
        const {
            numericLabels,
            numericBinSize,
            positionedBins,
            height,
            legendTitle,
            legendTitlePosition,
            defaultTextColor,
        } = state

        const bottomY = y + height

        return (
            <g
                id={makeFigmaId("numeric-color-legend")}
                className="numericColorLegend"
            >
                <g id={makeFigmaId("lines")}>
                    {numericLabels.map((label, index) => {
                        const style = state.getMarkerStyleConfig(label.bin)
                        return (
                            <line
                                key={index}
                                id={makeFigmaId(label.text)}
                                x1={roundPixel(
                                    x + label.bounds.x + label.bounds.width / 2
                                )}
                                y1={roundPixel(bottomY - numericBinSize)}
                                x2={roundPixel(
                                    x + label.bounds.x + label.bounds.width / 2
                                )}
                                y2={roundPixel(
                                    bottomY +
                                        label.bounds.y +
                                        label.bounds.height
                                )}
                                stroke={
                                    label.raised && style.stroke
                                        ? darkenColorForLine(style.stroke)
                                        : style.stroke
                                }
                                strokeWidth={style.strokeWidth}
                            />
                        )
                    })}
                </g>
                <g id={makeFigmaId("swatches")}>
                    {_.sortBy(
                        positionedBins.map((positionedBin, index) => {
                            const bin = positionedBin.bin
                            const style = state.getMarkerStyleConfig(bin)

                            const fill = bin.patternRef
                                ? `url(#${bin.patternRef})`
                                : style.fill

                            return (
                                <NumericBinRect
                                    key={index}
                                    x={roundPixel(x + positionedBin.x)}
                                    y={roundPixel(bottomY - numericBinSize)}
                                    width={roundPixel(positionedBin.width)}
                                    height={roundPixel(numericBinSize)}
                                    fill={fill}
                                    stroke={style.stroke}
                                    strokeWidth={style.strokeWidth}
                                    opacity={style.opacity}
                                    isOpenLeft={
                                        bin instanceof NumericBin
                                            ? bin.props.isOpenLeft
                                            : false
                                    }
                                    isOpenRight={
                                        bin instanceof NumericBin
                                            ? bin.props.isOpenRight
                                            : false
                                    }
                                    onMouseEnter={() => {
                                        onMouseEnter?.(bin)
                                        onMouseOver?.(bin)
                                    }}
                                    onMouseLeave={() => onMouseLeave?.()}
                                />
                            )
                        }),
                        (rect) => rect.props["strokeWidth"]
                    )}
                </g>
                <g id={makeFigmaId("labels")}>
                    {numericLabels.map((label, index) => {
                        const style = state.getTextStyleConfig(label.bin)
                        return (
                            <text
                                key={index}
                                x={x + label.bounds.x}
                                y={bottomY + label.bounds.y}
                                dy={dyFromAlign(VerticalAlign.bottom)}
                                fontSize={label.fontSize}
                                style={{ fill: style.color, ...style }}
                            >
                                {label.text}
                            </text>
                        )
                    })}
                </g>
                {legendTitle && legendTitlePosition && (
                    <TextWrapSvg
                        textWrap={legendTitle}
                        x={x + legendTitlePosition.x}
                        y={y + legendTitlePosition.y}
                        fill={defaultTextColor}
                    />
                )}
            </g>
        )
    }
)

interface NumericBinRectProps extends React.SVGAttributes<SVGElement> {
    x: number
    y: number
    width: number
    height: number
    isOpenLeft?: boolean
    isOpenRight?: boolean
}

const NumericBinRect = (props: NumericBinRectProps): React.ReactElement => {
    const { isOpenLeft, isOpenRight, x, y, width, height, ...restProps } = props
    if (isOpenRight) {
        const a = ARROW_SIZE
        const w = roundPixel(width - a)
        const d = removeAllWhitespace(`
            M ${roundPixel(x)}, ${roundPixel(y)}
            l ${w}, 0
            l ${roundPixel(a)}, ${roundPixel(height / 2)}
            l ${roundPixel(-a)}, ${roundPixel(height / 2)}
            l ${roundPixel(-w)}, 0
            z
        `)
        return <path d={d} {...restProps} />
    } else if (isOpenLeft) {
        const a = ARROW_SIZE
        const w = roundPixel(width - a)
        const d = removeAllWhitespace(`
            M ${roundPixel(x + a)}, ${roundPixel(y)}
            l ${w}, 0
            l 0, ${roundPixel(height)}
            l ${roundPixel(-w)}, 0
            l ${roundPixel(-a)}, ${roundPixel(-height / 2)}
            z
        `)
        return <path d={d} {...restProps} />
    } else {
        return (
            <rect
                x={roundPixel(x)}
                y={roundPixel(y)}
                width={roundPixel(width)}
                height={roundPixel(height)}
                {...restProps}
            />
        )
    }
}
