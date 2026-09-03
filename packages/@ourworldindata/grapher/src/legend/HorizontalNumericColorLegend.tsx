import * as React from "react"
import {
    dyFromAlign,
    removeAllWhitespace,
    makeFigmaId,
    VerticalAlign,
} from "@ourworldindata/utils"
import { TextWrapSvg } from "@ourworldindata/components"
import { ColorScaleBin, isNumericBin } from "../color/ColorScaleBin"
import { darkenColorForLine } from "../color/ColorUtils"
import { Emphasis } from "../interaction/Emphasis"
import {
    LegendMarkerStyle,
    resolveLegendMarkerStyle,
    resolveLegendTextStyle,
} from "./LegendStyleConfig"
import { HorizontalNumericColorLegendState } from "./HorizontalNumericColorLegendState"
import {
    HorizontalColorLegendProps,
    PositionedBin,
} from "./HorizontalColorLegendTypes"
import {
    ARROW_SIZE,
    DEFAULT_NUMERIC_BIN_STROKE,
    DEFAULT_NUMERIC_BIN_STROKE_WIDTH,
    DEFAULT_TEXT_COLOR,
} from "./HorizontalColorLegendConstants"

export function HorizontalNumericColorLegend(
    props: HorizontalColorLegendProps<HorizontalNumericColorLegendState>
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
    const {
        numericLabels,
        binSize,
        positionedBins,
        height,
        title,
        titlePosition,
    } = state

    const defaultTextColor =
        styleConfig?.text?.default?.color ?? DEFAULT_TEXT_COLOR

    const bottomY = y + height

    const markerStyleFor = (bin: ColorScaleBin): LegendMarkerStyle =>
        resolveLegendMarkerStyle(styleConfig, binEmphasis?.get(bin), {
            fill: bin.color,
            stroke: DEFAULT_NUMERIC_BIN_STROKE,
            strokeWidth: DEFAULT_NUMERIC_BIN_STROKE_WIDTH,
        })

    const onPointerEnter =
        (bin: ColorScaleBin) =>
        (event: React.PointerEvent): void => {
            if (event.pointerType === "touch" && onTouchSelect) return

            onMouseEnter?.(bin)
            onMouseOver?.(bin)
        }

    const onPointerLeave = (event: React.PointerEvent): void => {
        if (event.pointerType === "touch" && onTouchSelect) return

        onMouseLeave?.()
    }

    const onPointerUp =
        (bin: ColorScaleBin) =>
        (event: React.PointerEvent): void => {
            if (event.pointerType === "touch") onTouchSelect?.(bin)
        }

    const renderBin = (
        positionedBin: PositionedBin,
        isHighlightOverlay = false
    ): React.ReactElement => {
        const bin = positionedBin.bin
        const style = markerStyleFor(bin)
        const fill = bin.patternRef ? `url(#${bin.patternRef})` : style.fill
        const inert = isHighlightOverlay || !interactive

        return (
            <NumericBinRect
                key={
                    isHighlightOverlay
                        ? `highlight-${positionedBin.x}`
                        : positionedBin.x
                }
                x={x + positionedBin.x}
                y={bottomY - binSize}
                width={positionedBin.width}
                height={binSize}
                fill={isHighlightOverlay ? "none" : fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                opacity={style.opacity}
                isOpenLeft={isNumericBin(bin) ? bin.props.isOpenLeft : false}
                isOpenRight={isNumericBin(bin) ? bin.props.isOpenRight : false}
                pointerEvents={isHighlightOverlay ? "none" : undefined}
                onPointerEnter={inert ? undefined : onPointerEnter(bin)}
                onPointerLeave={inert ? undefined : onPointerLeave}
                onPointerUp={inert ? undefined : onPointerUp(bin)}
            />
        )
    }

    const showTouchHitAreas = interactive && !!onTouchSelect

    return (
        <g
            id={makeFigmaId("numeric-color-legend")}
            className="numericColorLegend"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <g id={makeFigmaId("lines")}>
                {numericLabels.map((label, index) => {
                    const style = markerStyleFor(label.bin)
                    return (
                        <line
                            key={index}
                            id={makeFigmaId(label.text)}
                            x1={x + label.bounds.x + label.bounds.width / 2}
                            y1={bottomY - binSize}
                            x2={x + label.bounds.x + label.bounds.width / 2}
                            y2={bottomY + label.bounds.y + label.bounds.height}
                            // if we use a light color for stroke (e.g. white), we want it to stay
                            // "invisible", except for raised labels, where we want *some* contrast.
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
                {positionedBins.map((positionedBin) =>
                    renderBin(positionedBin)
                )}
                {/*
                        Render highlighted bins last so their stroke is painted above adjacent bins.
                        Note that this renders the highlighted bin twice, once in its normal place and once in the highlight layer here.

                        Another option to solve the cosmetic stroke issue would be to sort their bins by their emphasis state, but that has caused issues with React event handlers becoming detached from the elements and `pointerleave` events not firing.
                    */}
                {positionedBins
                    .filter(
                        (positionedBin) =>
                            binEmphasis?.get(positionedBin.bin) ===
                            Emphasis.Highlighted
                    )
                    .map((positionedBin) => renderBin(positionedBin, true))}
            </g>
            <g id={makeFigmaId("labels")}>
                {numericLabels.map((label, index) => {
                    const style = resolveLegendTextStyle(
                        styleConfig,
                        binEmphasis?.get(label.bin)
                    )
                    return (
                        <text
                            key={index}
                            x={x + label.bounds.x}
                            y={bottomY + label.bounds.y}
                            // we can't use dominant-baseline to do proper alignment since our svg-to-png library Sharp
                            // doesn't support that (https://github.com/lovell/sharp/issues/1996), so we'll have to make
                            // do with some rough positioning.
                            dy={dyFromAlign(VerticalAlign.bottom)}
                            fontSize={label.fontSize}
                            style={{ fill: style.color, ...style }}
                        >
                            {label.text}
                        </text>
                    )
                })}
            </g>
            {showTouchHitAreas && (
                // Add invisible hit areas above each swatch for touch interaction.
                // They are the height of the legend labels, and only handle touch events.
                <g id={makeFigmaId("swatch-hit-areas")} aria-hidden="true">
                    {positionedBins.map((positionedBin, index) => (
                        <rect
                            key={index}
                            x={x + positionedBin.x}
                            y={y}
                            width={positionedBin.width}
                            height={Math.max(0, height - binSize)}
                            fill="transparent"
                            pointerEvents="all"
                            onPointerUp={onPointerUp(positionedBin.bin)}
                        />
                    ))}
                </g>
            )}
            {title && titlePosition && (
                <TextWrapSvg
                    textWrap={title}
                    x={x + titlePosition.x}
                    y={y + titlePosition.y}
                    fill={defaultTextColor}
                />
            )}
        </g>
    )
}

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
        const w = width - a
        const d = removeAllWhitespace(`
            M ${x}, ${y}
            l ${w}, 0
            l ${a}, ${height / 2}
            l ${-a}, ${height / 2}
            l ${-w}, 0
            z
        `)
        return <path d={d} {...restProps} />
    } else if (isOpenLeft) {
        const a = ARROW_SIZE
        const w = width - a
        const d = removeAllWhitespace(`
            M ${x + a}, ${y}
            l ${w}, 0
            l 0, ${height}
            l ${-w}, 0
            l ${-a}, ${-height / 2}
            z
        `)
        return <path d={d} {...restProps} />
    } else {
        return <rect x={x} y={y} width={width} height={height} {...restProps} />
    }
}
