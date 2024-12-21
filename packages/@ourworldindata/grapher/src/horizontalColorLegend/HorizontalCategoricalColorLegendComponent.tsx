import React from "react"
import { HorizontalCategoricalColorLegend } from "./HorizontalCategoricalColorLegend"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    dyFromAlign,
    makeIdForHumanConsumption,
    VerticalAlign,
} from "@ourworldindata/utils"
import { GRAPHER_OPACITY_MUTE } from "../core/GrapherConstants"
import { OWID_NON_FOCUSED_GRAY } from "../color/ColorConstants"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"
import { ColorScaleBin } from "../color/ColorScaleBin"

@observer
export class HorizontalCategoricalColorLegendComponent extends React.Component<{
    legend: HorizontalCategoricalColorLegend
    legendOpacity?: number
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: ColorScaleBin) => void
    onLegendClick?: (d: ColorScaleBin) => void

    focusColors?: string[] // focused colors are bolded
    hoverColors?: string[] // non-hovered colors are muted
    activeColors?: string[] // inactive colors are grayed out
}> {
    @computed private get legend(): HorizontalCategoricalColorLegend {
        return this.props.legend
    }

    renderLabels(): React.ReactElement {
        const { marks } = this.legend
        const { focusColors, hoverColors = [] } = this.props

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
                            x={this.legend.legendX + mark.label.bounds.x}
                            y={
                                this.legend.categoryLegendY +
                                mark.label.bounds.y
                            }
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

    renderSwatches(): React.ReactElement {
        const { marks } = this.legend
        const { categoricalBinStroke } = this.legend.props
        const { legendOpacity, activeColors, hoverColors = [] } = this.props

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
                            x={this.legend.legendX + mark.x}
                            y={this.legend.categoryLegendY + mark.y}
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

    renderInteractiveElements(): React.ReactElement {
        const { props } = this
        const { marks } = this.legend

        return (
            <g>
                {marks.map((mark, index) => {
                    const mouseOver = (): void =>
                        props.onLegendMouseOver
                            ? props.onLegendMouseOver(mark.bin)
                            : undefined
                    const mouseLeave = (): void =>
                        props.onLegendMouseLeave
                            ? props.onLegendMouseLeave()
                            : undefined
                    const click = props.onLegendClick
                        ? (): void => props.onLegendClick?.(mark.bin)
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
                                x={this.legend.legendX + mark.x}
                                y={
                                    this.legend.categoryLegendY +
                                    mark.y -
                                    this.legend.rectPadding / 2
                                }
                                height={mark.rectSize + this.legend.rectPadding}
                                width={
                                    mark.width + SPACE_BETWEEN_CATEGORICAL_BINS
                                }
                                fill="#fff"
                                opacity={0}
                            />
                        </g>
                    )
                })}
            </g>
        )
    }

    render(): React.ReactElement {
        const isInteractive =
            this.props.onLegendClick ||
            this.props.onLegendMouseOver ||
            this.props.onLegendMouseLeave

        return (
            <g
                id={makeIdForHumanConsumption("categorical-color-legend")}
                className="categoricalColorLegend"
            >
                {this.renderSwatches()}
                {this.renderLabels()}
                {isInteractive && this.renderInteractiveElements()}
            </g>
        )
    }
}
