import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChoroplethDatum } from "./ChoroplethMap"
import { Tooltip } from "charts/chart/Tooltip"
import { takeWhile, last, first, isMobile } from "charts/utils/Util"
import {
    SparkBars,
    SparkBarsDatum,
    SparkBarsProps
} from "charts/sparkBars/SparkBars"
import { CovidTimeSeriesValue } from "site/client/covid/CovidTimeSeriesValue"
import { Grapher } from "charts/core/Grapher"

interface MapTooltipProps {
    inputYear?: number
    formatYear: (year: number) => string
    mapToDataEntities: { [id: string]: string }
    tooltipDatum?: ChoroplethDatum
    tooltipTarget: { x: number; y: number; featureId: string }
    isEntityClickable?: boolean
    chart: Grapher
}

@observer
export class MapTooltip extends React.Component<MapTooltipProps> {
    @computed get chart() {
        return this.props.chart
    }

    sparkBarsDatumXAccessor = (d: SparkBarsDatum) => d.year

    @computed get sparkBarsToDisplay() {
        return isMobile() ? 13 : 20
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
        const tooltipDatum = this.props.tooltipDatum
        if (!tooltipDatum) return sparkBarValues

        this.chart.mapTransform.dimension?.valueByEntityAndYear
            .get(tooltipDatum.entity)
            ?.forEach((value, key) => {
                sparkBarValues.push({
                    year: key,
                    value: value as number
                })
            })

        return takeWhile(
            sparkBarValues,
            d => d.year <= tooltipDatum.year
        ).slice(-this.sparkBarsToDisplay)
    }

    @computed get sparkBarsDomain(): [number, number] {
        const lastVal = last(this.sparkBarsData)

        const end = lastVal ? this.sparkBarsDatumXAccessor(lastVal) : 0
        const start = end > 0 ? end - this.sparkBarsToDisplay + 1 : 0

        return [start, end]
    }

    @computed get currentSparkBar() {
        const lastVal = last(this.sparkBarsData)
        return lastVal ? this.sparkBarsDatumXAccessor(lastVal) : undefined
    }

    @computed get renderSparkBars() {
        const { chart } = this
        return (
            chart.hasChartTab &&
            (chart.isLineChart ||
                (chart.isScatter && chart.scatterTransform.hasTimeline))
        )
    }

    @computed get darkestColorInColorScheme() {
        const { colorScale } = this.chart.mapTransform
        return colorScale.isColorSchemeInverted
            ? first(colorScale.baseColors)
            : last(colorScale.baseColors)
    }

    @computed get barColor() {
        const { colorScale } = this.chart.mapTransform
        return colorScale.singleColorScale &&
            !colorScale.customNumericColorsActive
            ? this.darkestColorInColorScheme
            : undefined
    }

    render() {
        const {
            tooltipTarget,
            inputYear,
            mapToDataEntities,
            tooltipDatum,
            isEntityClickable
        } = this.props

        const tooltipMessage = this.chart.isScatter
            ? "Click to select"
            : "Click for change over time"

        const { renderSparkBars, barColor } = this
        return (
            <Tooltip
                tooltipContainer={this.chart}
                key="mapTooltip"
                x={tooltipTarget.x}
                y={tooltipTarget.y}
                style={{ textAlign: "center", padding: "8px" }}
                offsetX={15}
                offsetY={10}
                offsetYDirection={"upward"}
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
                                {renderSparkBars && (
                                    <div className="plot">
                                        <SparkBars<SparkBarsDatum>
                                            {...this.sparkBarsProps}
                                            currentX={this.currentSparkBar}
                                            color={barColor}
                                        />
                                    </div>
                                )}
                                <div
                                    className={
                                        "value" +
                                        (renderSparkBars ? "" : " no-plot")
                                    }
                                >
                                    <CovidTimeSeriesValue
                                        className="current"
                                        value={this.chart.mapTransform.formatTooltipValue(
                                            tooltipDatum.value
                                        )}
                                        formattedDate={this.props.formatYear(
                                            tooltipDatum.year as number
                                        )}
                                        valueColor={
                                            renderSparkBars ? barColor : "black"
                                        }
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
                            {tooltipMessage}
                        </p>
                    </div>
                )}
            </Tooltip>
        )
    }
}
