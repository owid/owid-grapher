import * as _ from "lodash-es"
import React from "react"
import {
    exposeInstanceOnWindow,
    Bounds,
    HorizontalAlign,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    BACKGROUND_COLOR,
    DiscreteBarChartManager,
    DiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import {
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { DiscreteBars } from "./DiscreteBars"
import { makeProjectedDataPatternId } from "./DiscreteBarChartHelpers"
import { TextWrap } from "@ourworldindata/components"

const LEGEND_PADDING = 25
const DEFAULT_PROJECTED_DATA_COLOR_IN_LEGEND = "#787878"

// If an entity name exceeds this width, we use the short name instead (if available)
const SOFT_MAX_LABEL_WIDTH = 90

// todo: duplicated
const BAR_SPACING_FACTOR = 0.35

export interface Label {
    valueString: string
    timeString: string
    width: number
}

export type DiscreteBarChartProps = ChartComponentProps<DiscreteBarChartState>

@observer
export class DiscreteBarChart
    extends React.Component<DiscreteBarChartProps>
    implements ChartInterface, AxisManager, HorizontalColorLegendManager
{
    base = React.createRef<SVGGElement>()

    constructor(props: DiscreteBarChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): DiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): DiscreteBarChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padRight(10)
    }

    @computed private get boundsWithoutColorLegend(): Bounds {
        return this.bounds.padTop(
            this.showColorLegend ? this.legendHeight + LEGEND_PADDING : 0
        )
    }

    // Account for the width of the legend
    @computed private get seriesLegendWidth(): number {
        return _.max(this.sizedSeries.map((s) => s.label?.width ?? 0)) ?? 0
    }

    @computed private get innerBounds(): Bounds {
        return this.boundsWithoutColorLegend.padLeft(this.seriesLegendWidth)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get barCount(): number {
        return this.series.length
    }

    @computed private get labelFontSize(): number {
        const availableHeight = this.bounds.height / this.barCount
        return Math.min(
            GRAPHER_FONT_SCALE_12 * this.fontSize,
            1.1 * availableHeight
        )
    }

    @computed private get entityLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return { fontSize: this.labelFontSize, fontWeight: 700 }
    }

    // useful if `barHeight` can't be used due to a cyclic dependency
    // keep in mind though that this is not exactly the same as `barHeight`
    @computed private get approximateBarHeight(): number {
        const { height } = this.bounds
        const approximateMaxBarHeight = height / this.barCount
        const approximateBarSpacing =
            approximateMaxBarHeight * BAR_SPACING_FACTOR
        const totalWhiteSpace = this.barCount * approximateBarSpacing
        return (height - totalWhiteSpace) / this.barCount
    }

    @computed private get sizedSeries(): DiscreteBarSeries[] {
        // can't use `this.barHeight` due to a circular dependency
        const barHeight = this.approximateBarHeight

        return this.series.map((series) => {
            // make sure we're dealing with a single-line text fragment
            const entityName = series.entityName.replace(/\n/g, " ").trim()

            const maxLegendWidth = 0.3 * this.bounds.width

            let label = new TextWrap({
                text: entityName,
                maxWidth: maxLegendWidth,
                ...this.entityLabelStyle,
            })

            // prevent labels from being taller than the bar
            let step = 0
            while (
                label.height > barHeight &&
                label.lines.length > 1 &&
                step < 10 // safety net
            ) {
                label = new TextWrap({
                    text: entityName,
                    maxWidth: label.maxWidth + 20,
                    ...this.entityLabelStyle,
                })
                step += 1
            }

            // if the label is too long, use the short name instead
            const tooLong =
                label.width > SOFT_MAX_LABEL_WIDTH ||
                label.width > maxLegendWidth
            if (tooLong && series.shortEntityName) {
                label = new TextWrap({
                    text: series.shortEntityName,
                    maxWidth: label.maxWidth,
                    ...this.entityLabelStyle,
                })
            }

            return { ...series, label }
        })
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    private renderDefs(): React.ReactElement | void {
        const projections = this.series.filter(
            (series) => series.yColumn.isProjection
        )
        const uniqProjections = _.uniqBy(projections, (series) => series.color)
        if (projections.length === 0) return

        return (
            <defs>
                {/* passed to the legend as pattern for the projected data legend item */}
                <StripedProjectedDataPattern
                    patternId={makeProjectedDataPatternId(
                        this.projectedDataColorInLegend
                    )}
                    color={this.projectedDataColorInLegend}
                />
                {/* make a pattern for every series with a unique color */}
                {uniqProjections.map((series) => (
                    <StripedProjectedDataPattern
                        key={series.color}
                        patternId={makeProjectedDataPatternId(series.color)}
                        color={series.color}
                    />
                ))}
            </defs>
        )
    }

    private renderChartArea(): React.ReactElement {
        return (
            <>
                {this.renderDefs()}
                {this.showColorLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                <DiscreteBars
                    chartState={this.chartState}
                    bounds={this.innerBounds}
                    series={this.sizedSeries}
                    labelFontSize={this.labelFontSize}
                />
            </>
        )
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return this.manager.isStatic ? (
            this.renderChartArea()
        ) : (
            <g
                ref={this.base}
                id={makeIdForHumanConsumption("discrete-bar-chart")}
                className="DiscreteBarChart"
            >
                {this.renderChartArea()}
            </g>
        )
    }

    // Color legend props

    @computed private get hasColorLegend(): boolean {
        return this.chartState.hasColorScale || this.chartState.hasProjectedData
    }

    @computed private get showColorLegend(): boolean {
        return this.hasColorLegend && !!this.manager.showLegend
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get legendMaxWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    // TODO just pass colorScale to legend and let it figure it out?
    @computed get numericLegendData(): ColorScaleBin[] {
        const legendBins = this.chartState.colorScale.legendBins.slice()

        // Show a "Projected data" legend item with a striped pattern if appropriate
        if (this.chartState.hasProjectedData) {
            legendBins.push(
                new CategoricalBin({
                    color: this.projectedDataColorInLegend,
                    label: "Projected data",
                    index: 0,
                    value: "projected",
                    patternRef: makeProjectedDataPatternId(
                        this.projectedDataColorInLegend
                    ),
                })
            )
        }

        // Move CategoricalBins to end
        return _.sortBy(legendBins, (bin) => bin instanceof CategoricalBin)
    }

    @computed private get projectedDataColorInLegend(): string {
        // if a single color is in use, use that color in the legend
        if (_.uniqBy(this.series, "color").length === 1)
            return this.series[0].color
        return DEFAULT_PROJECTED_DATA_COLOR_IN_LEGEND
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (this.hasColorLegend) {
            return {
                numericLegendData: this.numericLegendData,
            }
        }
        return undefined
    }

    numericBinSize = 10
    numericBinStroke = BACKGROUND_COLOR
    numericBinStrokeWidth = 1
    legendTextColor = "#555"
    legendTickSize = 1

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
        return this.chartState.hasColorScale && this.manager.showLegend
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get numericLegendY(): number {
        return this.bounds.top
    }

    @computed get legendTitle(): string | undefined {
        return this.chartState.hasColorScale
            ? this.chartState.colorScale.legendDescription
            : undefined
    }

    @computed get legendHeight(): number {
        return this.numericLegend?.height ?? 0
    }

    // End of color legend props

    @computed private get series(): DiscreteBarSeries[] {
        return this.chartState.series
    }
}

function StripedProjectedDataPattern({
    patternId,
    color,
    opacity = 0.5,
    size = 7,
    strokeWidth = 10,
}: {
    patternId: string
    color: string
    opacity?: number
    size?: number
    strokeWidth?: number
}): React.ReactElement {
    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={size}
            height={size}
            patternTransform="rotate(45)"
        >
            {/* semi-transparent background */}
            <rect width={size} height={size} fill={color} opacity={opacity} />

            {/* stripes */}
            <line
                x1="0"
                y1="0"
                x2="0"
                y2={size}
                stroke={color}
                strokeWidth={strokeWidth}
            />
        </pattern>
    )
}
