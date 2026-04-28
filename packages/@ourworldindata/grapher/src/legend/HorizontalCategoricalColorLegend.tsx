import * as React from "react"
import { dyFromAlign, makeFigmaId, VerticalAlign } from "@ourworldindata/utils"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { roundPixel } from "../chart/ChartUtils"
import { HorizontalCategoricalColorLegendState } from "./HorizontalCategoricalColorLegendState"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"

interface HorizontalCategoricalColorLegendProps {
    state: HorizontalCategoricalColorLegendState
    x: number
    y: number
    onMouseEnter?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onMouseOver?: (bin: ColorScaleBin) => void
    onClick?: (bin: ColorScaleBin) => void
    interactive?: boolean
}

export function HorizontalCategoricalColorLegend({
    state,
    x,
    y,
    onMouseEnter,
    onMouseLeave,
    onMouseOver,
    onClick,
    interactive,
}: HorizontalCategoricalColorLegendProps): React.ReactElement {
    const { marks, rectPadding } = state
    const cursor = onClick ? "pointer" : "default"

    return (
        <g
            id={makeFigmaId("categorical-color-legend")}
            className="categoricalColorLegend"
        >
            <g id={makeFigmaId("swatches")}>
                {marks.map((mark, index) => {
                    const style = state.getMarkerStyleConfig(mark.bin)

                    const fill = mark.bin.patternRef
                        ? `url(#${mark.bin.patternRef})`
                        : style.fill

                    return (
                        <rect
                            id={makeFigmaId(mark.label.text)}
                            key={`${mark.label}-${index}`}
                            x={roundPixel(x + mark.x)}
                            y={roundPixel(y + mark.y)}
                            width={roundPixel(mark.rectSize)}
                            height={roundPixel(mark.rectSize)}
                            style={{ ...style, fill }}
                        />
                    )
                })}
            </g>
            <g id={makeFigmaId("labels")}>
                {marks.map((mark, index) => {
                    const style = state.getTextStyleConfig(mark.bin)

                    return (
                        <text
                            key={`${mark.label}-${index}`}
                            x={roundPixel(x + mark.label.bounds.x)}
                            y={roundPixel(y + mark.label.bounds.y)}
                            dy={dyFromAlign(VerticalAlign.middle)}
                            fontSize={mark.label.fontSize}
                            fontWeight={style.fontWeight}
                            style={{ fill: style.color, ...style }}
                        >
                            {mark.label.text}
                        </text>
                    )
                })}
            </g>
            {interactive && (
                <g>
                    {marks.map((mark, index) => (
                        <g
                            key={`${mark.label}-${index}`}
                            onMouseEnter={() => {
                                onMouseEnter?.(mark.bin)
                            }}
                            onMouseOver={() => {
                                onMouseOver?.(mark.bin)
                            }}
                            onMouseLeave={() => {
                                onMouseLeave?.()
                            }}
                            onClick={
                                onClick ? () => onClick(mark.bin) : undefined
                            }
                            style={{ cursor }}
                        >
                            {/* for hover interaction */}
                            <rect
                                x={roundPixel(x + mark.x)}
                                y={roundPixel(y + mark.y - rectPadding / 2)}
                                height={roundPixel(mark.rectSize + rectPadding)}
                                width={roundPixel(
                                    mark.width + SPACE_BETWEEN_CATEGORICAL_BINS
                                )}
                                fill="#fff"
                                opacity={0}
                            />
                        </g>
                    ))}
                </g>
            )}
        </g>
    )
}
