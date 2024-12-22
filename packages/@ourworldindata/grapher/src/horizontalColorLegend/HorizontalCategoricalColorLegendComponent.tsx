import React from "react"
import { HorizontalCategoricalColorLegend } from "./HorizontalCategoricalColorLegend"
import {
    Color,
    dyFromAlign,
    makeIdForHumanConsumption,
    VerticalAlign,
} from "@ourworldindata/utils"
import { GRAPHER_OPACITY_MUTE } from "../core/GrapherConstants"
import { OWID_NON_FOCUSED_GRAY } from "../color/ColorConstants"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"
import { ColorScaleBin } from "../color/ColorScaleBin"

interface HorizontalCategoricalColorLegendProps {
    legend: HorizontalCategoricalColorLegend

    // positioning
    x?: number
    y?: number

    // presentation
    opacity?: number
    swatchStrokeColor?: Color

    // state
    focusColors?: string[] // focused colors are bolded
    hoverColors?: string[] // non-hovered colors are muted
    activeColors?: string[] // inactive colors are grayed out

    // interaction
    onMouseLeave?: () => void
    onMouseOver?: (d: ColorScaleBin) => void
    onClick?: (d: ColorScaleBin) => void
}

export function HorizontalCategoricalColorLegendComponent({
    legend,
    x = 0,
    y = 0,
    opacity,
    swatchStrokeColor,
    focusColors,
    hoverColors,
    activeColors,
    onClick,
    onMouseOver,
    onMouseLeave,
}: HorizontalCategoricalColorLegendProps): React.ReactElement {
    const isInteractive = onClick || onMouseOver || onMouseLeave

    return (
        <g
            id={makeIdForHumanConsumption("categorical-color-legend")}
            className="categoricalColorLegend"
        >
            <Swatches
                legend={legend}
                x={x}
                y={y}
                opacity={opacity}
                swatchStrokeColor={swatchStrokeColor}
                activeColors={activeColors}
                hoverColors={hoverColors}
            />
            <Labels
                legend={legend}
                x={x}
                y={y}
                focusColors={focusColors}
                hoverColors={hoverColors}
            />
            {isInteractive && (
                <InteractiveElements
                    legend={legend}
                    x={x}
                    y={y}
                    onClick={onClick}
                    onMouseOver={onMouseOver}
                    onMouseLeave={onMouseLeave}
                />
            )}
        </g>
    )
}

function Labels({
    x,
    y,
    legend,
    focusColors,
    hoverColors = [],
}: {
    x: number
    y: number
    legend: HorizontalCategoricalColorLegend
    focusColors?: string[] // focused colors are bolded
    hoverColors?: string[] // non-hovered colors are muted
}): React.ReactElement {
    const { marks } = legend

    return (
        <g id={makeIdForHumanConsumption("labels")}>
            {marks.map((mark, index) => {
                const isFocus = focusColors?.includes(mark.bin.color)
                const isNotHovered =
                    hoverColors.length > 0 &&
                    !hoverColors.includes(mark.bin.color)

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
                        fontWeight={isFocus ? "bold" : undefined}
                        opacity={isNotHovered ? GRAPHER_OPACITY_MUTE : 1}
                    >
                        {mark.label.text}
                    </text>
                )
            })}
        </g>
    )
}

function Swatches({
    legend,
    x,
    y,
    activeColors,
    hoverColors = [],
    opacity,
    swatchStrokeColor,
}: {
    legend: HorizontalCategoricalColorLegend
    x: number
    y: number
    activeColors?: string[] // inactive colors are grayed out
    hoverColors?: string[] // non-hovered colors are muted
    opacity?: number
    swatchStrokeColor?: Color
}): React.ReactElement {
    const { marks } = legend

    return (
        <g id={makeIdForHumanConsumption("swatches")}>
            {marks.map((mark, index) => {
                const isActive = activeColors?.includes(mark.bin.color)
                const isHovered = hoverColors.includes(mark.bin.color)
                const isNotHovered =
                    hoverColors.length > 0 &&
                    !hoverColors.includes(mark.bin.color)

                const color = mark.bin.patternRef
                    ? `url(#${mark.bin.patternRef})`
                    : mark.bin.color

                const fill =
                    isHovered || isActive || activeColors === undefined
                        ? color
                        : OWID_NON_FOCUSED_GRAY

                return (
                    <rect
                        id={makeIdForHumanConsumption(mark.label.text)}
                        key={`${mark.label}-${index}`}
                        x={x + mark.x}
                        y={y + mark.y}
                        width={legend.swatchSize}
                        height={legend.swatchSize}
                        fill={fill}
                        stroke={swatchStrokeColor}
                        strokeWidth={0.4}
                        opacity={isNotHovered ? GRAPHER_OPACITY_MUTE : opacity}
                    />
                )
            })}
        </g>
    )
}

function InteractiveElements({
    legend,
    x,
    y,
    onClick,
    onMouseOver,
    onMouseLeave,
}: {
    legend: HorizontalCategoricalColorLegend
    x: number
    y: number
    onMouseLeave?: () => void
    onMouseOver?: (d: ColorScaleBin) => void
    onClick?: (d: ColorScaleBin) => void
}): React.ReactElement {
    const { marks } = legend

    return (
        <g>
            {marks.map((mark, index) => {
                const mouseOver = (): void =>
                    onMouseOver ? onMouseOver(mark.bin) : undefined
                const mouseLeave = (): void =>
                    onMouseLeave ? onMouseLeave() : undefined
                const click = onClick
                    ? (): void => onClick?.(mark.bin)
                    : undefined

                const cursor = click ? "pointer" : "default"

                return (
                    <g
                        key={`${mark.label}-${index}`}
                        onMouseOver={mouseOver}
                        onMouseLeave={mouseLeave}
                        onClick={click}
                        style={{ cursor }}
                    >
                        {/* for hover interaction */}
                        <rect
                            x={x + mark.x}
                            y={y + mark.y - legend.swatchMarginRight / 2}
                            height={
                                legend.swatchSize + legend.swatchMarginRight
                            }
                            width={mark.width + SPACE_BETWEEN_CATEGORICAL_BINS}
                            fill="#fff"
                            opacity={0}
                        />
                    </g>
                )
            })}
        </g>
    )
}
