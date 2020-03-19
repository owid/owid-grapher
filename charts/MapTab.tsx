import * as React from "react"
import { Bounds } from "./Bounds"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    ChoroplethMap,
    ChoroplethData,
    ChoroplethDatum,
    GeoFeature,
    MapBracket,
    MapEntity
} from "./ChoroplethMap"
import { MapLegend, MapLegendView } from "./MapLegend"
import { getRelativeMouse } from "./Util"
import { ChartConfig } from "./ChartConfig"
import { MapConfig } from "./MapConfig"
import { MapLegendBin } from "./MapData"
import { MapProjection } from "./MapProjection"
import { Tooltip } from "./Tooltip"
import { select } from "d3-selection"
import { easeCubic } from "d3-ease"
import { ChartViewContext, ChartViewContextType } from "./ChartViewContext"
import { ChartLayout, ChartLayoutView } from "./ChartLayout"
import { ChartView } from "./ChartView"
import { LoadingChart } from "./LoadingChart"

// TODO refactor to use transform pattern, bit too much info for a pure component

interface MapWithLegendProps {
    bounds: Bounds
    choroplethData: ChoroplethData
    years: number[]
    inputYear?: number
    legendData: MapLegendBin[]
    legendTitle: string
    projection: MapProjection
    defaultFill: string
    mapToDataEntities: { [id: string]: string }
}

@observer
class MapWithLegend extends React.Component<MapWithLegendProps> {
    @observable focusEntity?: any
    @observable.ref tooltip: React.ReactNode | null = null
    @observable focusBracket: MapBracket
    @observable tooltipTarget?: { x: number; y: number; featureId: string }

    static contextType = ChartViewContext
    context!: ChartViewContextType

    base: React.RefObject<SVGGElement> = React.createRef()
    @action.bound onMapMouseOver(d: GeoFeature, ev: React.MouseEvent) {
        const datum =
            d.id === undefined ? undefined : this.props.choroplethData[d.id]
        this.focusEntity = { id: d.id, datum: datum || { value: "No data" } }

        const mouse = getRelativeMouse(this.base.current, ev)
        if (d.id !== undefined)
            this.tooltipTarget = {
                x: mouse.x,
                y: mouse.y,
                featureId: d.id as string
            }
    }

    @action.bound onMapMouseLeave() {
        this.focusEntity = undefined
        this.tooltipTarget = undefined
    }

    // Determine if we can go to line chart by clicking on a map entity
    @computed get isEntityClickable() {
        return (
            this.context.chart.hasChartTab &&
            this.context.chart.isLineChart &&
            !this.context.chartView.isMobile
        )
    }

    @action.bound onClick(d: GeoFeature) {
        if (!this.isEntityClickable) return

        const { chart } = this.context
        const entity = this.props.mapToDataEntities[d.id as string]
        const datakeys = chart.data.availableKeysByEntity.get(entity)

        if (datakeys && datakeys.length) {
            chart.tab = "chart"
            chart.data.selectedKeys = datakeys
        }
    }

    componentWillUnmount() {
        this.onMapMouseLeave()
        this.onLegendMouseLeave()
    }

    @action.bound onLegendMouseOver(d: MapEntity) {
        this.focusBracket = d
    }

    @action.bound onTargetChange({
        targetStartYear
    }: {
        targetStartYear: number
    }) {
        this.context.chart.map.targetYear = targetStartYear
    }

    @action.bound onLegendMouseLeave() {
        this.focusBracket = null
    }

    @computed get hasTimeline(): boolean {
        return (
            !this.context.chart.map.props.hideTimeline &&
            this.props.years.length > 1 &&
            !this.context.chartView.isExport
        )
    }

    @computed get mapLegend(): MapLegend {
        const that = this
        return new MapLegend({
            get bounds() {
                return that.props.bounds.padBottom(15)
            },
            get legendData() {
                return that.props.legendData
            },
            get equalSizeBins() {
                return that.context.chart.map.props.equalSizeBins
            },
            get title() {
                return that.props.legendTitle
            },
            get focusBracket() {
                return that.focusBracket
            },
            get focusEntity() {
                return that.focusEntity
            },
            get fontSize() {
                return that.context.chart.baseFontSize
            }
        })
    }

    @computed get tooltipDatum(): ChoroplethDatum | undefined {
        return this.tooltipTarget
            ? this.props.choroplethData[this.tooltipTarget.featureId]
            : undefined
    }

    componentDidMount() {
        select(this.base.current)
            .selectAll("path")
            .attr("data-fill", function() {
                return (this as SVGPathElement).getAttribute("fill")
            })
            .attr("fill", this.context.chart.map.noDataColor)
            .transition()
            .duration(500)
            .ease(easeCubic)
            .attr("fill", function() {
                return (this as SVGPathElement).getAttribute("data-fill")
            })
            .attr("data-fill", function() {
                return (this as SVGPathElement).getAttribute("fill")
            })
    }

    render() {
        const {
            choroplethData,
            projection,
            defaultFill,
            bounds,
            inputYear,
            mapToDataEntities
        } = this.props
        const {
            focusBracket,
            focusEntity,
            mapLegend,
            tooltipTarget,
            tooltipDatum
        } = this

        return (
            <g ref={this.base} className="mapTab">
                <ChoroplethMap
                    bounds={bounds.padBottom(mapLegend.height + 15)}
                    choroplethData={choroplethData}
                    projection={projection}
                    defaultFill={defaultFill}
                    onHover={this.onMapMouseOver}
                    onHoverStop={this.onMapMouseLeave}
                    onClick={this.onClick}
                    focusBracket={focusBracket}
                    focusEntity={focusEntity}
                />
                <MapLegendView
                    legend={mapLegend}
                    onMouseOver={this.onLegendMouseOver}
                    onMouseLeave={this.onLegendMouseLeave}
                />
                {tooltipTarget && (
                    <Tooltip
                        key="mapTooltip"
                        x={tooltipTarget.x}
                        y={tooltipTarget.y}
                        style={{ textAlign: "center" }}
                    >
                        <h3
                            style={{
                                padding: "0.3em 0.9em",
                                margin: 0,
                                fontWeight: "normal",
                                fontSize: "1em"
                            }}
                        >
                            {mapToDataEntities[tooltipTarget.featureId] ||
                                tooltipTarget.featureId.replace(/_/g, " ")}
                        </h3>
                        <div
                            style={{
                                margin: 0,
                                padding: "0.3em 0.9em",
                                fontSize: "0.8em"
                            }}
                        >
                            <span>
                                {tooltipDatum
                                    ? this.context.chart.map.data.formatTooltipValue(
                                          tooltipDatum.value
                                      )
                                    : `No data for ${this.context.chart.formatYearFunction(
                                          inputYear as number
                                      )}`}
                            </span>
                            <br />
                            {tooltipDatum && tooltipDatum.year !== inputYear && (
                                <div>
                                    in
                                    <br />
                                    <span>
                                        {this.context.chart.formatYearFunction(
                                            tooltipDatum.year
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                        {this.isEntityClickable && (
                            <div>
                                <p
                                    style={{
                                        margin: 0,
                                        padding: "0.3em 0.9em",
                                        fontSize: "0.7em",
                                        opacity: 0.6
                                    }}
                                >
                                    Click for change over time
                                </p>
                            </div>
                        )}
                    </Tooltip>
                )}
            </g>
        )
    }
}

interface MapTabProps {
    chart: ChartConfig
    chartView: ChartView
    bounds: Bounds
}

@observer
export class MapTab extends React.Component<MapTabProps> {
    @computed get map(): MapConfig {
        return this.props.chart.map as MapConfig
    }

    @computed get layout() {
        const that = this
        return new ChartLayout({
            get chart() {
                return that.props.chart
            },
            get chartView() {
                return that.props.chartView
            },
            get bounds() {
                return that.props.bounds
            }
        })
    }

    render() {
        const { map } = this
        const { layout } = this

        return (
            <ChartLayoutView layout={this.layout}>
                {this.props.chart.data.isReady ? (
                    <MapWithLegend
                        bounds={layout.innerBounds}
                        choroplethData={map.data.choroplethData}
                        years={map.data.timelineYears}
                        inputYear={map.data.targetYear}
                        legendData={map.data.legendData}
                        legendTitle={map.data.legendTitle}
                        projection={map.projection}
                        defaultFill={map.noDataColor}
                        mapToDataEntities={map.data.mapToDataEntities}
                    />
                ) : (
                    <LoadingChart bounds={layout.innerBounds} />
                )}
            </ChartLayoutView>
        )
    }
}
