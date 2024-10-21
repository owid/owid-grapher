import React from "react"
import { sum, max, makeIdForHumanConsumption } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    GRAPHER_FONT_SCALE_11_2,
    BASE_FONT_SIZE,
} from "../core/GrapherConstants"
import { Color } from "@ourworldindata/types"

export interface VerticalColorLegendManager {
    maxLegendWidth?: number
    fontSize?: number
    legendItems: LegendItem[]
    legendTitle?: string
    onLegendMouseOver?: (color: string) => void
    onLegendClick?: (color: string) => void
    onLegendMouseLeave?: () => void
    legendX?: number
    legendY?: number
    activeColors: Color[]
    focusColors?: Color[]
    isStatic?: boolean
}

export interface LegendItem {
    label?: string
    minText?: string
    maxText?: string
    color: Color
}

interface SizedLegendSeries {
    textWrap: TextWrap
    color: Color
    width: number
    height: number
    yOffset: number
}

@observer
export class VerticalColorLegend extends React.Component<{
    manager: VerticalColorLegendManager
}> {
    @computed get manager(): VerticalColorLegendManager {
        return this.props.manager
    }

    @computed private get maxLegendWidth(): number {
        return this.manager.maxLegendWidth ?? 100
    }

    @computed private get fontSize(): number {
        return (
            GRAPHER_FONT_SCALE_11_2 * (this.manager.fontSize ?? BASE_FONT_SIZE)
        )
    }
    @computed private get rectSize(): number {
        return Math.round(this.fontSize / 1.4)
    }

    private rectPadding = 5
    private lineHeight = 5

    @computed private get title(): TextWrap | undefined {
        if (!this.manager.legendTitle) return undefined
        return new TextWrap({
            maxWidth: this.maxLegendWidth,
            fontSize: this.fontSize,
            fontWeight: 700,
            lineHeight: 1,
            text: this.manager.legendTitle,
        })
    }

    @computed private get titleHeight(): number {
        if (!this.title) return 0
        return this.title.height + 5
    }

    @computed private get series(): SizedLegendSeries[] {
        const {
            manager,
            fontSize,
            rectSize,
            rectPadding,
            titleHeight,
            lineHeight,
        } = this

        let runningYOffset = titleHeight
        return manager.legendItems.map((series) => {
            let label = series.label
            // infer label for numeric bins
            if (!label && series.minText && series.maxText) {
                label = `${series.minText} – ${series.maxText}`
            }
            const textWrap = new TextWrap({
                maxWidth: this.maxLegendWidth,
                fontSize,
                lineHeight: 1,
                text: label ?? "",
            })
            const width = rectSize + rectPadding + textWrap.width
            const height = Math.max(textWrap.height, rectSize)
            const yOffset = runningYOffset

            runningYOffset += height + lineHeight

            return {
                textWrap,
                color: series.color,
                width,
                height,
                yOffset,
            }
        })
    }

    @computed get width(): number {
        const widths = this.series.map((series) => series.width)
        if (this.title) widths.push(this.title.width)
        return max(widths) ?? 0
    }

    @computed get height(): number {
        return (
            this.titleHeight +
            sum(this.series.map((series) => series.height)) +
            this.lineHeight * this.series.length
        )
    }

    @computed get legendX(): number {
        return this.manager.legendX ?? 0
    }

    @computed get legendY(): number {
        return this.manager.legendY ?? 0
    }

    renderLabels(): React.ReactElement {
        const { series, manager, rectSize, rectPadding } = this
        const { focusColors } = manager

        return (
            <g id={makeIdForHumanConsumption("labels")}>
                {series.map((series) => {
                    const isFocus = focusColors?.includes(series.color) ?? false

                    const textX = this.legendX + rectSize + rectPadding
                    const textY = this.legendY + series.yOffset

                    return series.textWrap.render(
                        textX,
                        textY,
                        isFocus
                            ? {
                                  textProps: {
                                      style: { fontWeight: "bold" },
                                  },
                              }
                            : undefined
                    )
                })}
            </g>
        )
    }

    renderSwatches(): React.ReactElement {
        const { manager, series, rectSize, rectPadding } = this
        const { activeColors } = manager

        return (
            <g>
                {series.map((series, index) => {
                    const isActive = activeColors.includes(series.color)

                    const textX = this.legendX + rectSize + rectPadding
                    const textY = this.legendY + series.yOffset

                    const renderedTextPosition =
                        series.textWrap.getPositionForSvgRendering(textX, textY)

                    return (
                        <rect
                            id={makeIdForHumanConsumption(series.textWrap.text)}
                            key={index}
                            x={this.legendX}
                            y={renderedTextPosition[1] - rectSize}
                            width={rectSize}
                            height={rectSize}
                            fill={isActive ? series.color : "#ccc"}
                        />
                    )
                })}
            </g>
        )
    }

    renderInteractiveElements(): React.ReactElement {
        const { series, manager, lineHeight } = this
        const { onLegendClick, onLegendMouseOver, onLegendMouseLeave } = manager
        return (
            <g>
                {series.map((series, index) => {
                    const mouseOver = onLegendMouseOver
                        ? (): void => onLegendMouseOver(series.color)
                        : undefined
                    const mouseLeave = onLegendMouseLeave || undefined
                    const click = onLegendClick
                        ? (): void => onLegendClick(series.color)
                        : undefined

                    const cursor = click ? "pointer" : "default"

                    return (
                        <g
                            key={index}
                            className="legendMark"
                            onMouseOver={mouseOver}
                            onMouseLeave={mouseLeave}
                            onClick={click}
                            style={{ cursor }}
                        >
                            <rect
                                x={this.legendX}
                                y={
                                    this.legendY +
                                    series.yOffset -
                                    lineHeight / 2
                                }
                                width={series.width}
                                height={series.height + lineHeight}
                                fill="#fff"
                                fillOpacity={0}
                            />
                        </g>
                    )
                })}
            </g>
        )
    }

    render(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("vertical-color-legend")}
                className="ScatterColorLegend clickable"
            >
                {this.title &&
                    this.title.render(this.legendX, this.legendY, {
                        textProps: {
                            fontWeight: 700,
                        },
                    })}
                {this.renderLabels()}
                {this.renderSwatches()}
                {!this.manager.isStatic && this.renderInteractiveElements()}
            </g>
        )
    }
}
