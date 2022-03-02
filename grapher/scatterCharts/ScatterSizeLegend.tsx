import React from "react"
import { computed } from "mobx"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { TextWrap } from "../text/TextWrap.js"
import { BASE_FONT_SIZE } from "../core/GrapherConstants.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { first, last } from "../../clientUtils/Util.js"
import { getElementWithHalo } from "./Halos.js"
import {
    ScatterSeries,
    SCATTER_POINT_MAX_RADIUS,
    SCATTER_POINT_OPACITY,
    SCATTER_POINT_STROKE_WIDTH,
    SCATTER_POINT_DEFAULT_RADIUS,
} from "./ScatterPlotChartConstants.js"
import { darkenColorForText } from "../color/ColorUtils.js"

export interface ScatterSizeLegendManager {
    sidebarWidth: number
    sizeColumn: CoreColumn
    sizeScale: ScaleLinear<number, number>
    fontSize?: number
    tooltipSeries?: ScatterSeries
}

const LEGEND_PADDING = 3
const LEGEND_CIRCLE_COLOR = "#bbb"
const LEGEND_VALUE_COLOR = "#444"
const LABEL_PADDING = 2
const LABEL_COLOR = "#777"
const TITLE_COLOR = "#222"

const MIN_FONT_SIZE = 10

export class ScatterSizeLegend {
    manager: ScatterSizeLegendManager
    constructor(manager: ScatterSizeLegendManager) {
        this.manager = manager
    }

    @computed private get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get maxWidth(): number {
        return this.manager.sidebarWidth
    }

    @computed private get ticks(): number[] {
        const { sizeScale } = this.manager
        const [domainStart, domainEnd] = sizeScale.domain()
        if (domainStart === domainEnd) return [domainStart]
        const [largestTick, ...restTicks] = sizeScale.ticks(6).reverse()
        if (largestTick === undefined) return []
        const ticks = [largestTick]
        restTicks.forEach((value) => {
            if (
                // make sure there is enough distance to prevent overlap with previous tick
                sizeScale(value) <= sizeScale(last(ticks)!) - 6 &&
                // don't go below the minimum tick radius
                sizeScale(value) >= 6
            ) {
                ticks.push(value)
            }
        })
        return ticks
    }

    private getPointRadius(value: number | undefined): number {
        if (value === undefined) return SCATTER_POINT_DEFAULT_RADIUS
        return this.manager.sizeScale(value)
    }

    // input radius, output font size
    @computed private get fontSizeScale(): ScaleLinear<number, number> {
        return scaleLinear()
            .domain([6, SCATTER_POINT_MAX_RADIUS])
            .range([8, 11])
            .clamp(true)
    }

    // Since it's circular, this is both the width and the height of the legend.
    @computed private get legendSize(): number {
        if (this.ticks.length === 0) return 0
        const maxRadius = last(this.manager.sizeScale.range()) ?? 0
        // adding some padding to account for label sticking out at the top
        return 2 * maxRadius + 2
    }

    @computed private get label(): TextWrap {
        const fontSize = Math.max(MIN_FONT_SIZE, 0.625 * this.baseFontSize)
        return new TextWrap({
            text: "Points sized by",
            maxWidth: this.maxWidth + 6,
            fontSize,
        })
    }

    @computed private get title(): TextWrap {
        const fontSize = Math.max(MIN_FONT_SIZE, 0.6875 * this.baseFontSize)
        return new TextWrap({
            text: this.manager.sizeColumn.displayName,
            // Allow text to _slightly_ go outside boundaries.
            // Since we have padding left and right, this doesn't
            // actually visibly overflow.
            maxWidth: this.maxWidth + 6,
            fontSize,
            fontWeight: 700,
        })
    }

    @computed get width(): number {
        return this.manager.sidebarWidth
    }

    @computed get height(): number {
        return (
            this.legendSize +
            LEGEND_PADDING +
            this.label.height +
            LABEL_PADDING +
            this.title.height
        )
    }

    @computed private get highlight():
        | { value: number | undefined; color: string }
        | undefined {
        const { tooltipSeries } = this.manager
        if (
            tooltipSeries?.points.length === 1 &&
            first(tooltipSeries.points)?.size !== undefined
        ) {
            return {
                value: first(tooltipSeries.points)!.size,
                color: tooltipSeries.color,
            }
        }
        return undefined
    }

    private renderLegend(targetX: number, targetY: number): JSX.Element {
        const { highlight } = this
        const cx = targetX + this.maxWidth / 2
        return (
            <React.Fragment>
                {this.ticks.map((value) => {
                    const radius = this.getPointRadius(value)
                    return (
                        <LegendItem
                            key={value}
                            label={this.manager.sizeColumn.formatValueShortWithAbbreviations(
                                value
                            )}
                            cx={cx}
                            cy={targetY + this.legendSize - radius}
                            circleRadius={radius}
                            circleStroke={
                                highlight ? "#ddd" : LEGEND_CIRCLE_COLOR
                            }
                            labelFontSize={this.fontSizeScale(radius)}
                            labelFill={highlight ? "#bbb" : LEGEND_VALUE_COLOR}
                        />
                    )
                })}
                {highlight && (
                    <LegendItem
                        key={highlight.value}
                        label={this.manager.sizeColumn.formatValueShort(
                            highlight.value
                        )}
                        cx={cx}
                        cy={
                            targetY +
                            this.legendSize -
                            this.getPointRadius(highlight.value)
                        }
                        circleFill={highlight.color}
                        circleStroke={"#333"}
                        circleStrokeWidth={SCATTER_POINT_STROKE_WIDTH}
                        circleRadius={this.getPointRadius(highlight.value)}
                        circleOpacity={SCATTER_POINT_OPACITY}
                        labelFontSize={12}
                        labelFill={darkenColorForText(highlight.color)}
                        labelFontWeight={700}
                        outsideLabel={true}
                    />
                )}
            </React.Fragment>
        )
    }

    render(
        targetX: number,
        targetY: number,
        renderOptions: React.SVGAttributes<SVGGElement> = {}
    ): JSX.Element {
        const centerX = targetX + this.maxWidth / 2
        return (
            <g {...renderOptions}>
                {this.renderLegend(targetX, targetY)}
                {this.label.render(
                    centerX,
                    targetY + this.legendSize + LEGEND_PADDING,
                    {
                        fill: LABEL_COLOR,
                        textAnchor: "middle",
                    }
                )}
                {this.title.render(
                    centerX,
                    targetY +
                        this.legendSize +
                        LEGEND_PADDING +
                        this.label.height +
                        LABEL_PADDING,
                    {
                        fill: TITLE_COLOR,
                        textAnchor: "middle",
                    }
                )}
            </g>
        )
    }
}

const LegendItem = ({
    label,
    cx,
    cy,
    circleRadius,
    circleFill = "none",
    circleStroke = LEGEND_CIRCLE_COLOR,
    circleStrokeWidth = 1.25,
    circleOpacity = 1,
    labelFill = LEGEND_VALUE_COLOR,
    labelFontSize,
    labelFontWeight = 400,
    outsideLabel = false,
}: {
    label: string
    cx: number
    cy: number
    circleRadius: number
    circleFill?: string
    circleStroke?: string
    circleStrokeWidth?: number
    circleOpacity?: number
    labelFill?: string
    labelFontSize: number
    labelFontWeight?: number
    outsideLabel?: boolean
}): JSX.Element => {
    const style: React.CSSProperties = {
        fontSize: labelFontSize,
        fontWeight: labelFontWeight,
        textAnchor: "middle",
    }
    return (
        <g>
            <circle
                cx={cx}
                cy={cy}
                r={circleRadius}
                fill={circleFill}
                stroke={circleStroke}
                strokeWidth={circleStrokeWidth}
                opacity={circleOpacity}
            />
            {getElementWithHalo(
                label,
                <text
                    x={cx}
                    y={cy - circleRadius}
                    dy={outsideLabel ? "-.32em" : ".47em"}
                    fill={labelFill}
                    style={style}
                >
                    {label}
                </text>,
                { ...style, strokeWidth: 3.5 }
            )}
        </g>
    )
}
