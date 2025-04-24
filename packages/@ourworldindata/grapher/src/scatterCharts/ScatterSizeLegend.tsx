import * as React from "react"
import * as R from "remeda"
import { computed } from "mobx"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { TextWrap, Halo } from "@ourworldindata/components"
import {
    Color,
    first,
    makeIdForHumanConsumption,
    OwidVariableRoundingMode,
} from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_10,
    GRAPHER_FONT_SCALE_11,
    GRAPHER_TEXT_OUTLINE_FACTOR,
} from "../core/GrapherConstants"
import { CoreColumn } from "@ourworldindata/core-table"
import {
    ScatterSeries,
    SCATTER_POINT_MAX_RADIUS,
    SCATTER_POINT_OPACITY,
    SCATTER_POINT_STROKE_WIDTH,
    SCATTER_POINT_DEFAULT_RADIUS,
} from "./ScatterPlotChartConstants"
import { darkenColorForText } from "../color/ColorUtils"
import {
    GRAPHER_BACKGROUND_DEFAULT,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "../color/ColorConstants"

export interface ScatterSizeLegendManager {
    sidebarWidth: number
    sizeColumn: CoreColumn
    sizeScale: ScaleLinear<number, number>
    fontSize?: number
    tooltipSeries?: ScatterSeries
    backgroundColor?: Color
}

const LEGEND_PADDING = 3
const LEGEND_CIRCLE_COLOR = "#bbb"
const LEGEND_VALUE_COLOR = "#444"
const LABEL_PADDING = 2
const LABEL_COLOR = GRAPHER_LIGHT_TEXT
const TITLE_COLOR = GRAPHER_DARK_TEXT

const MIN_FONT_SIZE = 9

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
        const [largestTick, ...restTicks] = sizeScale.ticks(6).toReversed()
        if (largestTick === undefined) return []
        const ticks = [largestTick]
        restTicks.forEach((value) => {
            if (
                // make sure there is enough distance to prevent overlap with previous tick
                sizeScale(value) <= sizeScale(R.last(ticks)!) - 6 &&
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
    @computed private get fontSizeFromRadius(): ScaleLinear<number, number> {
        return (
            scaleLinear()
                // choosing the domain & range somewhat arbitrarily here,
                // by experimenting visually with font sizes
                .domain([6, SCATTER_POINT_MAX_RADIUS])
                .range([8, 11])
                .clamp(true)
        )
    }

    // Since it's circular, this is both the width and the height of the legend.
    @computed private get legendSize(): number {
        if (this.ticks.length === 0) return 0
        const maxRadius = R.last(this.manager.sizeScale.range()) ?? 0
        // adding some padding to account for label sticking out at the top
        return 2 * maxRadius + 2
    }

    @computed private get label(): TextWrap {
        const fontSize = Math.max(
            MIN_FONT_SIZE,
            GRAPHER_FONT_SCALE_10 * this.baseFontSize
        )
        return new TextWrap({
            text: "Circles sized by",
            // Allow text to _slightly_ go outside boundaries.
            // Since we have padding left and right, this doesn't
            // actually visibly overflow.
            maxWidth: this.maxWidth + 12,
            fontSize,
            lineHeight: 1,
        })
    }

    @computed private get title(): TextWrap {
        const fontSize = Math.max(
            MIN_FONT_SIZE,
            GRAPHER_FONT_SCALE_11 * this.baseFontSize
        )
        return new TextWrap({
            text: this.manager.sizeColumn.displayName,
            // Allow text to _slightly_ go outside boundaries.
            // Since we have padding left and right, this doesn't
            // actually visibly overflow.
            maxWidth: this.maxWidth + 10,
            fontSize,
            fontWeight: 700,
            lineHeight: 1,
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

    private renderLegend(targetX: number, targetY: number): React.ReactElement {
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
                                value,
                                {
                                    roundingMode:
                                        OwidVariableRoundingMode.decimalPlaces,
                                }
                            )}
                            cx={cx}
                            cy={targetY + this.legendSize - radius}
                            circleRadius={radius}
                            circleStroke={
                                highlight ? "#ddd" : LEGEND_CIRCLE_COLOR
                            }
                            labelFontSize={this.fontSizeFromRadius(radius)}
                            labelFill={highlight ? "#bbb" : LEGEND_VALUE_COLOR}
                            backgroundColor={this.manager.backgroundColor}
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
                        backgroundColor={this.manager.backgroundColor}
                    />
                )}
            </React.Fragment>
        )
    }

    render(
        targetX: number,
        targetY: number,
        renderOptions: React.SVGAttributes<SVGGElement> = {}
    ): React.ReactElement {
        const centerX = targetX + this.maxWidth / 2
        return (
            <g id={makeIdForHumanConsumption("size-legend")} {...renderOptions}>
                {this.renderLegend(targetX, targetY)}
                {this.label.renderSVG(
                    centerX,
                    targetY + this.legendSize + LEGEND_PADDING,
                    {
                        textProps: {
                            fill: LABEL_COLOR,
                            textAnchor: "middle",
                        },
                    }
                )}
                {this.title.renderSVG(
                    centerX,
                    targetY +
                        this.legendSize +
                        LEGEND_PADDING +
                        this.label.height +
                        LABEL_PADDING,
                    {
                        textProps: {
                            fill: TITLE_COLOR,
                            textAnchor: "middle",
                        },
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
    backgroundColor = GRAPHER_BACKGROUND_DEFAULT,
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
    backgroundColor?: Color
}): React.ReactElement => {
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
            <Halo
                id={label}
                outlineWidth={GRAPHER_TEXT_OUTLINE_FACTOR * labelFontSize}
                outlineColor={backgroundColor}
            >
                <text
                    x={cx}
                    y={cy - circleRadius}
                    dy={outsideLabel ? "-.32em" : ".47em"}
                    fill={labelFill}
                    fontSize={labelFontSize}
                    fontWeight={labelFontWeight}
                    textAnchor="middle"
                >
                    {label}
                </text>
            </Halo>
        </g>
    )
}
