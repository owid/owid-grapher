import * as React from "react"
import { makeFigmaId, roundForSvg } from "@ourworldindata/utils"
import { TextWrapSvg } from "@ourworldindata/components"
import { ColorScaleBin, isNoDataBin } from "../color/ColorScaleBin"
import {
    resolveLegendMarkerStyle,
    resolveLegendTextStyle,
} from "./LegendStyleConfig"
import { HorizontalOrdinalColorLegendState } from "./HorizontalOrdinalColorLegendState"
import { HorizontalColorLegendProps } from "./HorizontalColorLegendTypes"
import { useDismissOnOutsidePointerDownOrUnmount } from "../hooks.js"
import {
    DEFAULT_NUMERIC_BIN_STROKE,
    DEFAULT_NUMERIC_BIN_STROKE_WIDTH,
} from "./HorizontalColorLegendConstants"

/** Outline of the No-data swatch, which takes precedence over the style config */
const NO_DATA_BIN_OUTLINE = {
    stroke: DEFAULT_NUMERIC_BIN_STROKE,
    strokeWidth: DEFAULT_NUMERIC_BIN_STROKE_WIDTH,
}

export function HorizontalOrdinalColorLegend(
    props: HorizontalColorLegendProps<HorizontalOrdinalColorLegendState>
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
    } = props
    const { labels, binHeight, binY, positionedBins, height } = state

    const isHoverable = interactive && !!onMouseOver
    useDismissOnOutsidePointerDownOrUnmount(
        isHoverable ? onMouseLeave : undefined
    )

    const binTop = y + binY

    const onPointerEnter =
        (bin: ColorScaleBin) =>
        (event: React.PointerEvent): void => {
            if (event.pointerType === "touch") return

            onMouseEnter?.(bin)
            onMouseOver?.(bin)
        }

    const onPointerLeave = (event: React.PointerEvent): void => {
        if (event.pointerType === "touch") return

        onMouseLeave?.()
    }

    const onPointerUp =
        (bin: ColorScaleBin) =>
        (event: React.PointerEvent): void => {
            if (event.pointerType === "touch") {
                onMouseEnter?.(bin)
                onMouseOver?.(bin)
            }
        }

    return (
        <g
            id={makeFigmaId("ordinal-color-legend")}
            className="ordinalColorLegend"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <g id={makeFigmaId("swatches")}>
                {positionedBins.map((positionedBin) => {
                    const { bin } = positionedBin
                    const style = {
                        ...resolveLegendMarkerStyle(
                            styleConfig,
                            binEmphasis?.get(bin),
                            { fill: bin.color }
                        ),
                        ...(isNoDataBin(bin) ? NO_DATA_BIN_OUTLINE : {}),
                    }
                    return (
                        <rect
                            key={positionedBin.x}
                            x={roundForSvg(x + positionedBin.x)}
                            y={roundForSvg(binTop)}
                            width={roundForSvg(positionedBin.width)}
                            height={roundForSvg(binHeight)}
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            opacity={style.opacity}
                            fill={
                                bin.fillPatternRef
                                    ? `url(#${bin.fillPatternRef})`
                                    : style.fill
                            }
                        />
                    )
                })}
            </g>
            <g id={makeFigmaId("labels")}>
                {labels.map((label, index) => {
                    const style = resolveLegendTextStyle(
                        styleConfig,
                        binEmphasis?.get(label.bin)
                    )
                    return (
                        <TextWrapSvg
                            key={index}
                            textWrap={label.textWrap}
                            x={x + label.left}
                            y={y + label.top}
                            textAnchor="start"
                            style={{ fill: style.color, ...style }}
                        />
                    )
                })}
            </g>
            {isHoverable && (
                <g aria-hidden="true">
                    {positionedBins.map((positionedBin, index) => (
                        <rect
                            key={index}
                            x={roundForSvg(x + positionedBin.x)}
                            y={roundForSvg(y)}
                            width={roundForSvg(positionedBin.width)}
                            height={roundForSvg(height)}
                            fill="transparent"
                            pointerEvents="all"
                            onPointerEnter={onPointerEnter(positionedBin.bin)}
                            onPointerLeave={onPointerLeave}
                            onPointerUp={onPointerUp(positionedBin.bin)}
                        />
                    ))}
                </g>
            )}
        </g>
    )
}
