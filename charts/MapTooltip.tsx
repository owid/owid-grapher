import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChoroplethDatum } from "./ChoroplethMap"
import { Tooltip } from "./Tooltip"
import { isMobile, takeWhile, last } from "./Util"
import { SparkBars, SparkBarsDatum, SparkBarsProps } from "./SparkBars"
import { CovidTimeSeriesValue } from "site/client/covid/CovidTimeSeriesValue"
import { ChartViewContext, ChartViewContextType } from "./ChartViewContext"

interface MapTooltipProps {
    inputYear?: number
    formatYear: (year: number) => string
    mapToDataEntities: { [id: string]: string }
    tooltipDatum?: ChoroplethDatum
    tooltipTarget: { x: number; y: number; featureId: string }
    isEntityClickable?: boolean
}

@observer
export class MapTooltip extends React.Component<MapTooltipProps> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    sparkBarsDatumXAccessor = (d: SparkBarsDatum) => d.year

    @computed get sparkBarsToDisplay() {
        return this.context.chartView.isMobile ? 13 : 20
    }

    @computed get sparkBarsProps(): SparkBarsProps<SparkBarsDatum> {
        return {
            data: this.sparkBarsData,
            x: this.sparkBarsDatumXAccessor,
            y: (d: SparkBarsDatum) => d.value,
            xDomain: this.sparkBarsDomain
        }
    }

    @computed get sparkBarsData(): SparkBarsDatum[] {
        const sparkBarValues: SparkBarsDatum[] = []
        if (!this.props.tooltipDatum) return sparkBarValues

        this.context.chart.map.data.dimension?.valueByEntityAndYear
            .get(this.props.tooltipDatum.entity)
            ?.forEach((value, key) => {
                sparkBarValues.push({
                    year: key,
                    value: value as number
                })
            })

        return takeWhile(
            sparkBarValues,
            d => d.year <= this.context.chart.map.data.targetYear
        ).slice(-this.sparkBarsToDisplay)
    }

    @computed get sparkBarsDomain(): [number, number] {
        const lastVal = last(this.sparkBarsData)

        const end = lastVal ? this.sparkBarsDatumXAccessor(lastVal) : 0
        const start = end > 0 ? end - this.sparkBarsToDisplay : 0

        return [start, end]
    }

    @computed get currentSparkBar() {
        const lastVal = last(this.sparkBarsData)
        return lastVal ? this.sparkBarsDatumXAccessor(lastVal) : undefined
    }

    render() {
        const {
            tooltipTarget,
            inputYear,
            mapToDataEntities,
            tooltipDatum,
            isEntityClickable
        } = this.props

        const renderPlot = this.context.chart.hasChartTab

        return (
            <Tooltip
                key="mapTooltip"
                x={tooltipTarget.x}
                y={tooltipTarget.y}
                style={{ textAlign: "center", padding: "8px" }}
                offsetX={30}
                offsetY={isMobile && -50}
            >
                <h3
                    style={{
                        padding: "0.3em 0.3em",
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
                        padding: "0.3em 0.3em"
                    }}
                >
                    {tooltipDatum ? (
                        <div className="map-tooltip">
                            <div className="trend">
                                {renderPlot && (
                                    <div className="plot">
                                        <SparkBars<SparkBarsDatum>
                                            {...this.sparkBarsProps}
                                            currentX={this.currentSparkBar}
                                        />
                                    </div>
                                )}
                                <div
                                    className={
                                        "value" + (renderPlot ? "" : " no-plot")
                                    }
                                >
                                    <CovidTimeSeriesValue
                                        className="current"
                                        value={this.context.chart.map.data.formatTooltipValue(
                                            tooltipDatum.value
                                        )}
                                        formattedDate={this.props.formatYear(
                                            tooltipDatum.year as number
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        `No data for ${this.props.formatYear(
                            inputYear as number
                        )}`
                    )}
                </div>
                {isEntityClickable && (
                    <div>
                        <p
                            style={{
                                margin: 0,
                                padding: "0.3em 0.9em",
                                fontSize: "13px",
                                opacity: 0.6
                            }}
                        >
                            Click for change over time
                        </p>
                    </div>
                )}
            </Tooltip>
        )
    }
}
