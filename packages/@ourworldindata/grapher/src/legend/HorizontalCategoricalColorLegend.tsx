import * as React from "react"
import { dyFromAlign, makeFigmaId, VerticalAlign } from "@ourworldindata/utils"
import {
    resolveLegendMarkerStyle,
    resolveLegendTextStyle,
} from "./LegendStyleConfig"
import { HorizontalCategoricalColorLegendState } from "./HorizontalCategoricalColorLegendState"
import { HorizontalColorLegendProps } from "./HorizontalColorLegendTypes"
import {
    CATEGORICAL_BIN_STROKE_WIDTH,
    SPACE_BETWEEN_CATEGORICAL_BINS,
} from "./HorizontalColorLegendConstants"

export function HorizontalCategoricalColorLegend(
    props: HorizontalColorLegendProps<HorizontalCategoricalColorLegendState>
): React.ReactElement {
    const {
        state,
        x,
        y,
        interactive = true,
        styleConfig,
        binEmphasis,
        onMouseEnter,
        onMouseOver,
        onMouseLeave,
        onTouchSelect,
    } = props
    const { marks, rectPadding } = state

    return (
        <g
            id={makeFigmaId("categorical-color-legend")}
            className="categoricalColorLegend"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <g id={makeFigmaId("swatches")}>
                {marks.map((mark, index) => {
                    const style = resolveLegendMarkerStyle(
                        styleConfig,
                        binEmphasis?.get(mark.bin),
                        {
                            fill: mark.bin.color,
                            strokeWidth: CATEGORICAL_BIN_STROKE_WIDTH,
                        }
                    )

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
                    const style = resolveLegendTextStyle(
                        styleConfig,
                        binEmphasis?.get(mark.bin)
                    )

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
            {interactive && (
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
                        const pointerUp = (event: React.PointerEvent): void => {
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
