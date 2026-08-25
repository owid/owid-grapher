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
import { Emphasis } from "../interaction/Emphasis"
import { HorizontalNumericColorLegendState } from "./HorizontalNumericColorLegendState"
import { PositionedBin } from "./HorizontalColorLegendTypes"
import { ARROW_SIZE } from "./HorizontalColorLegendConstants"

interface HorizontalNumericColorLegendProps {
    state: HorizontalNumericColorLegendState
    x: number
    y: number
    onMouseEnter?: (bin: ColorScaleBin) => void
    onMouseOver?: (bin: ColorScaleBin) => void
    onMouseLeave?: () => void
    onTouchSelect?: (bin: ColorScaleBin) => void
}

export const HorizontalNumericColorLegend = observer(
    function HorizontalNumericColorLegend({
        state,
        x,
        y,
        onMouseEnter,
        onMouseOver,
        onMouseLeave,
        onTouchSelect,
    }: HorizontalNumericColorLegendProps): React.ReactElement {
        const {
            numericLabels,
            binSize,
            positionedBins,
            height,
            title,
            titlePosition,
            defaultTextColor,
        } = state

        const bottomY = y + height

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
            const style = state.getMarkerStyle(bin)
            const fill = bin.patternRef ? `url(#${bin.patternRef})` : style.fill

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
                    isOpenLeft={
                        bin instanceof NumericBin ? bin.props.isOpenLeft : false
                    }
                    isOpenRight={
                        bin instanceof NumericBin
                            ? bin.props.isOpenRight
                            : false
                    }
                    pointerEvents={isHighlightOverlay ? "none" : undefined}
                    onPointerEnter={
                        isHighlightOverlay ? undefined : onPointerEnter(bin)
                    }
                    onPointerLeave={
                        isHighlightOverlay ? undefined : onPointerLeave
                    }
                    onPointerUp={
                        isHighlightOverlay ? undefined : onPointerUp(bin)
                    }
                />
            )
        }

        return (
            <g
                id={makeFigmaId("numeric-color-legend")}
                className="numericColorLegend"
                onPointerDown={stopPointerDownPropagation}
            >
                <g id={makeFigmaId("lines")}>
                    {numericLabels.map((label, index) => {
                        const style = state.getMarkerStyle(label.bin)
                        return (
                            <line
                                key={index}
                                id={makeFigmaId(label.text)}
                                x1={x + label.bounds.x + label.bounds.width / 2}
                                y1={bottomY - binSize}
                                x2={x + label.bounds.x + label.bounds.width / 2}
                                y2={
                                    bottomY +
                                    label.bounds.y +
                                    label.bounds.height
                                }
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
                                state.getBinEmphasis(positionedBin.bin) ===
                                Emphasis.Highlighted
                        )
                        .map((positionedBin) => renderBin(positionedBin, true))}
                </g>
                <g id={makeFigmaId("labels")}>
                    {numericLabels.map((label, index) => {
                        const style = state.getTextStyle(label.bin)
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
                {onTouchSelect && (
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
)

const stopPointerDownPropagation = (event: React.PointerEvent): void => {
    event.stopPropagation()
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
