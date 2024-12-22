import React from "react"
import { HorizontalCategoricalColorLegend } from "./HorizontalCategoricalColorLegend"
import {
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
    legendOpacity?: number
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: ColorScaleBin) => void
    onLegendClick?: (d: ColorScaleBin) => void

    focusColors?: string[] // focused colors are bolded
    hoverColors?: string[] // non-hovered colors are muted
    activeColors?: string[] // inactive colors are grayed out
}

export function HorizontalCategoricalColorLegendComponent({
    legend,
    legendOpacity,
    onLegendClick,
    onLegendMouseOver,
    onLegendMouseLeave,
    focusColors,
    hoverColors,
    activeColors,
}: HorizontalCategoricalColorLegendProps): React.ReactElement {
    const isInteractive =
        onLegendClick || onLegendMouseOver || onLegendMouseLeave

    return (
        <g
            id={makeIdForHumanConsumption("categorical-color-legend")}
            className="categoricalColorLegend"
        >
            <Swatches
                legend={legend}
                activeColors={activeColors}
                hoverColors={hoverColors}
                legendOpacity={legendOpacity}
            />
            <Labels
                legend={legend}
                focusColors={focusColors}
                hoverColors={hoverColors}
            />
            {isInteractive && (
                <InteractiveElements
                    legend={legend}
                    onLegendClick={onLegendClick}
                    onLegendMouseOver={onLegendMouseOver}
                    onLegendMouseLeave={onLegendMouseLeave}
                />
            )}
        </g>
    )
}

function Labels({
    legend,
    focusColors,
    hoverColors = [],
}: {
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
                        x={legend.legendX + mark.label.bounds.x}
                        y={legend.categoryLegendY + mark.label.bounds.y}
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
    activeColors,
    hoverColors = [],
    legendOpacity,
}: {
    legend: HorizontalCategoricalColorLegend
    activeColors?: string[] // inactive colors are grayed out
    hoverColors?: string[] // non-hovered colors are muted
    legendOpacity?: number
}): React.ReactElement {
    const { marks } = legend
    const { categoricalBinStroke } = legend.props

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

                const opacity = isNotHovered
                    ? GRAPHER_OPACITY_MUTE
                    : legendOpacity

                return (
                    <rect
                        id={makeIdForHumanConsumption(mark.label.text)}
                        key={`${mark.label}-${index}`}
                        x={legend.legendX + mark.x}
                        y={legend.categoryLegendY + mark.y}
                        width={mark.rectSize}
                        height={mark.rectSize}
                        fill={fill}
                        stroke={categoricalBinStroke}
                        strokeWidth={0.4}
                        opacity={opacity}
                    />
                )
            })}
        </g>
    )
}

function InteractiveElements({
    legend,
    onLegendClick,
    onLegendMouseOver,
    onLegendMouseLeave,
}: {
    legend: HorizontalCategoricalColorLegend
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: ColorScaleBin) => void
    onLegendClick?: (d: ColorScaleBin) => void
}): React.ReactElement {
    const { marks } = legend

    return (
        <g>
            {marks.map((mark, index) => {
                const mouseOver = (): void =>
                    onLegendMouseOver ? onLegendMouseOver(mark.bin) : undefined
                const mouseLeave = (): void =>
                    onLegendMouseLeave ? onLegendMouseLeave() : undefined
                const click = onLegendClick
                    ? (): void => onLegendClick?.(mark.bin)
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
                            x={legend.legendX + mark.x}
                            y={
                                legend.categoryLegendY +
                                mark.y -
                                legend.rectPadding / 2
                            }
                            height={mark.rectSize + legend.rectPadding}
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
