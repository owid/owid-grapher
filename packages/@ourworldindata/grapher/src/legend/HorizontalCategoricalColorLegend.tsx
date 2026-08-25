import * as React from "react"
import { observer } from "mobx-react"
import { dyFromAlign, makeFigmaId, VerticalAlign } from "@ourworldindata/utils"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { HorizontalCategoricalColorLegendState } from "./HorizontalCategoricalColorLegendState"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"

interface HorizontalCategoricalColorLegendProps {
    state: HorizontalCategoricalColorLegendState
    x: number
    y: number
    onMouseEnter?: (bin: ColorScaleBin) => void
    onMouseOver?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onTouchSelect?: (bin: ColorScaleBin) => void
    isStatic?: boolean
}

@observer
export class HorizontalCategoricalColorLegend extends React.Component<HorizontalCategoricalColorLegendProps> {
    override render(): React.ReactElement {
        const {
            state,
            x,
            y,
            onMouseEnter,
            onMouseOver,
            onMouseLeave,
            onTouchSelect,
            isStatic,
        } = this.props
        const { marks, rectPadding } = state

        return (
            <g
                id={makeFigmaId("categorical-color-legend")}
                className="categoricalColorLegend"
                onPointerDown={stopPointerDownPropagation}
            >
                <g id={makeFigmaId("swatches")}>
                    {marks.map((mark, index) => {
                        const style = state.getMarkerStyle(mark.bin)

                        const fill = mark.bin.patternRef
                            ? `url(#${mark.bin.patternRef})`
                            : style.fill

                        return (
                            <rect
                                id={makeFigmaId(mark.label.text)}
                                key={`${mark.label}-${index}`}
                                x={x + mark.x}
                                y={y + mark.y}
                                width={mark.rectSize}
                                height={mark.rectSize}
                                style={{ ...style, fill }}
                            />
                        )
                    })}
                </g>
                <g id={makeFigmaId("labels")}>
                    {marks.map((mark, index) => {
                        const style = state.getTextStyle(mark.bin)

                        return (
                            <text
                                key={`${mark.label}-${index}`}
                                x={x + mark.label.bounds.x}
                                y={y + mark.label.bounds.y}
                                // we can't use dominant-baseline to do proper alignment since our svg-to-png library Sharp
                                // doesn't support that (https://github.com/lovell/sharp/issues/1996), so we'll have to make
                                // do with some rough positioning.
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
                {!isStatic && (
                    <g>
                        {marks.map((mark, index) => {
                            const isTouchSelection = (
                                event: React.PointerEvent
                            ): boolean =>
                                event.pointerType === "touch" && !!onTouchSelect
                            const pointerEnter = (
                                event: React.PointerEvent
                            ): void => {
                                if (!isTouchSelection(event))
                                    onMouseEnter?.(mark.bin)
                            }
                            const pointerOver = (
                                event: React.PointerEvent
                            ): void => {
                                if (!isTouchSelection(event))
                                    onMouseOver?.(mark.bin)
                            }
                            const pointerLeave = (
                                event: React.PointerEvent
                            ): void => {
                                if (!isTouchSelection(event)) onMouseLeave?.()
                            }
                            const pointerUp = (
                                event: React.PointerEvent
                            ): void => {
                                if (event.pointerType === "touch")
                                    onTouchSelect?.(mark.bin)
                            }

                            return (
                                <g
                                    key={`${mark.label}-${index}`}
                                    onPointerEnter={pointerEnter}
                                    onPointerOver={pointerOver}
                                    onPointerLeave={pointerLeave}
                                    onPointerUp={pointerUp}
                                >
                                    {/* for hover interaction */}
                                    <rect
                                        x={x + mark.x}
                                        y={y + mark.y - rectPadding / 2}
                                        height={mark.rectSize + rectPadding}
                                        width={
                                            mark.width +
                                            SPACE_BETWEEN_CATEGORICAL_BINS
                                        }
                                        fill="#fff"
                                        opacity={0}
                                    />
                                </g>
                            )
                        })}
                    </g>
                )}
            </g>
        )
    }
}

const stopPointerDownPropagation = (event: React.PointerEvent): void => {
    event.stopPropagation()
}
