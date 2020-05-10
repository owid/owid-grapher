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
import { getRelativeMouse, last } from "./Util"
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
import { ControlsOverlay, ProjectionChooser } from "./Controls"
import { SparkBarsProps, SparkBars, SparkBarsDatum } from "./SparkBars"
import { CovidTimeSeriesValue } from "site/client/covid/CovidTimeSeriesValue"

const PROJECTION_CHOOSER_WIDTH = 110
const PROJECTION_CHOOSER_HEIGHT = 22

// TODO refactor to use transform pattern, bit too much info for a pure component

interface MapWithLegendProps {
    bounds: Bounds
    choroplethData: ChoroplethData
    years: number[]
    inputYear?: number
    formatYear: (year: number) => string
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

    // Determine if we can go to line chart by clicking on a given map entity
    isEntityClickable(featureId: string | number | undefined) {
        if (
            !this.context.chart.hasChartTab ||
            !this.context.chart.isLineChart ||
            this.context.chartView.isMobile ||
            featureId === undefined
        )
            return false

        const { chart } = this.context
        const entity = this.props.mapToDataEntities[featureId]
        const datakeys = chart.data.availableKeysByEntity.get(entity)

        return datakeys && datakeys.length
    }

    @action.bound onClick(d: GeoFeature) {
        if (!this.isEntityClickable(d.id)) return

        const { chart } = this.context
        const entity = this.props.mapToDataEntities[d.id as string]
        const keys = chart.data.availableKeysByEntity.get(entity)

        if (keys && keys.length) {
            chart.tab = "chart"
            chart.data.selectedKeys = keys
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

    @action.bound onProjectionChange(value: MapProjection) {
        this.context.chart.map.props.projection = value
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

    @computed get projectionChooserBounds() {
        const { bounds } = this.props
        return new Bounds(
            bounds.width - PROJECTION_CHOOSER_WIDTH + 15 - 3,
            5,
            PROJECTION_CHOOSER_WIDTH,
            PROJECTION_CHOOSER_HEIGHT
        )
    }

    sparkBarsDatumXAccessor = (d: SparkBarsDatum) => d.year

    @computed get sparkBarsToDisplay() {
        return this.context.chartView.isMobile ? 13 : 20
    }

    @computed get sparkBarsProps(): SparkBarsProps<SparkBarsDatum> {
        const sparkBarsData = this.sparkBarsData
        const [start, end] = this.sparkBarsDomain

        return {
            data: sparkBarsData,
            x: this.sparkBarsDatumXAccessor,
            y: (d: SparkBarsDatum) => d.value,
            xDomain: [start, end]
        }
    }

    @computed get sparkBarsData(): SparkBarsDatum[] {
        const sparkBarValues: SparkBarsDatum[] = []
        if (!this.tooltipDatum) return sparkBarValues

        this.context.chart.map.data.dimension?.valueByEntityAndYear
            .get(this.tooltipDatum.entity)
            ?.forEach((value, key) => {
                sparkBarValues.push({
                    year: key,
                    value: value as number
                })
            })

        return sparkBarValues
    }

    @computed get sparkBarsDomain() {
        const lastVal = last(this.sparkBarsData)

        const end = lastVal ? this.sparkBarsDatumXAccessor(lastVal) : 0
        const start = end > 0 ? end - this.sparkBarsToDisplay : 0

        return [start, end]
    }

    render() {
        const {
            choroplethData,
            projection,
            defaultFill,
            bounds,
            inputYear,
            mapToDataEntities,
            formatYear
        } = this.props
        const {
            focusBracket,
            focusEntity,
            mapLegend,
            tooltipTarget,
            tooltipDatum,
            projectionChooserBounds,
            sparkBarsProps
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
                <ControlsOverlay id="projection-chooser">
                    <ProjectionChooser
                        bounds={projectionChooserBounds}
                        value={projection}
                        onChange={this.onProjectionChange}
                    />
                </ControlsOverlay>
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
                                {tooltipDatum ? (
                                    <div className="temp">
                                        <div className="measure--deaths">
                                            <div className="trend">
                                                <div className="plot">
                                                    <SparkBars<SparkBarsDatum>
                                                        {...sparkBarsProps}
                                                    />
                                                </div>
                                                <div className="value">
                                                    {tooltipDatum && (
                                                        <CovidTimeSeriesValue
                                                            className="current"
                                                            value={this.context.chart.map.data.formatTooltipValue(
                                                                tooltipDatum.value
                                                            )}
                                                            formattedDate={formatYear(
                                                                inputYear as number
                                                            )}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    `No data for ${formatYear(
                                        inputYear as number
                                    )}`
                                )}
                                {/* {tooltipDatum
                                    ? this.context.chart.map.data.formatTooltipValue(
                                          tooltipDatum.value
                                      )
                                    : `No data for ${formatYear(
                                          inputYear as number
                                      )}`} */}
                            </span>
                            <br />
                            {tooltipDatum && tooltipDatum.year !== inputYear && (
                                <div>
                                    in
                                    <br />
                                    <span>{formatYear(tooltipDatum.year)}</span>
                                </div>
                            )}
                        </div>
                        {this.isEntityClickable(tooltipTarget.featureId) && (
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
                        formatYear={map.data.formatYear}
                    />
                ) : (
                    <LoadingChart bounds={layout.innerBounds} />
                )}
            </ChartLayoutView>
        )
    }
}

const sparkBarGenerator = (
    latestDatumForTooltipEntity: SparkBarsDatum | undefined
) => (props: SparkBarsProps<SparkBarsDatum>) => {
    // const { bars, datum } = props
    const date2 = new Date(Date.now())
    return (
        <div className="temp">
            <div className="measure--deaths">
                <div className="trend">
                    <div className="plot">
                        <SparkBars<SparkBarsDatum> {...props} />
                    </div>
                    <div className="value">
                        {latestDatumForTooltipEntity && (
                            <CovidTimeSeriesValue
                                className="current"
                                value={"bro"}
                                date={date2}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
