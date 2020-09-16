import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChoroplethDatum } from "./ChoroplethMap"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { takeWhile, last, first, isMobile } from "grapher/utils/Util"
import {
    SparkBars,
    SparkBarsDatum,
    SparkBarsProps,
} from "grapher/sparkBars/SparkBars"
import { SparkBarTimeSeriesValue } from "grapher/sparkBars/SparkBarTimeSeriesValue"
import { Grapher } from "grapher/core/Grapher"

interface MapTooltipProps {
    inputTime?: number
    mapToDataEntities: { [id: string]: string }
    tooltipDatum?: ChoroplethDatum
    tooltipTarget: { x: number; y: number; featureId: string }
    isEntityClickable?: boolean
    grapher: Grapher
}

@observer
export class MapTooltip extends React.Component<MapTooltipProps> {
    @computed get grapher() {
        return this.props.grapher
    }

    private sparkBarsDatumXAccessor = (d: SparkBarsDatum) => d.time

    @computed private get sparkBarsToDisplay() {
        return isMobile() ? 13 : 20
    }

    @computed private get sparkBarsProps(): SparkBarsProps<SparkBarsDatum> {
        return {
            data: this.sparkBarsData,
            x: this.sparkBarsDatumXAccessor,
            y: (d: SparkBarsDatum) => d.value,
            xDomain: this.sparkBarsDomain,
        }
    }

    @computed private get sparkBarsData() {
        const tooltipDatum = this.props.tooltipDatum
        if (!tooltipDatum) return []

        const sparkBarValues: SparkBarsDatum[] = []
        this.grapher.mapTransform.dimension?.column.valueByEntityNameAndTime
            .get(tooltipDatum.entity)
            ?.forEach((value, key) => {
                sparkBarValues.push({
                    time: key,
                    value: value as number,
                })
            })

        return takeWhile(
            sparkBarValues,
            (d) => d.time <= tooltipDatum.time
        ).slice(-this.sparkBarsToDisplay)
    }

    @computed private get sparkBarsDomain(): [number, number] {
        const lastVal = last(this.sparkBarsData)

        const end = lastVal ? this.sparkBarsDatumXAccessor(lastVal) : 0
        const start = end > 0 ? end - this.sparkBarsToDisplay + 1 : 0

        return [start, end]
    }

    @computed private get currentSparkBar() {
        const lastVal = last(this.sparkBarsData)
        return lastVal ? this.sparkBarsDatumXAccessor(lastVal) : undefined
    }

    @computed private get renderSparkBars() {
        const { grapher } = this
        return (
            grapher.hasChartTab &&
            (grapher.isLineChart ||
                (grapher.isScatter && grapher.scatterTransform.hasTimeline))
        )
    }

    @computed private get darkestColorInColorScheme() {
        const { colorScale } = this.grapher.mapTransform
        return colorScale.isColorSchemeInverted
            ? first(colorScale.baseColors)
            : last(colorScale.baseColors)
    }

    @computed private get barColor() {
        const { colorScale } = this.grapher.mapTransform
        return colorScale.singleColorScale &&
            !colorScale.customNumericColorsActive
            ? this.darkestColorInColorScheme
            : undefined
    }

    render() {
        const {
            tooltipTarget,
            inputTime,
            mapToDataEntities,
            tooltipDatum,
            isEntityClickable,
        } = this.props

        const tooltipMessage = this.grapher.isScatter
            ? "Click to select"
            : "Click for change over time"

        const { renderSparkBars, barColor } = this
        const formatYearFn =
            this.grapher.table.timeColumn?.formatValue ||
            ((value: any) => value)
        return (
            <Tooltip
                tooltipProvider={this.grapher}
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
                        fontSize: "1em",
                    }}
                >
                    {mapToDataEntities[tooltipTarget.featureId] ||
                        tooltipTarget.featureId.replace(/_/g, " ")}
                </h3>
                <div
                    style={{
                        margin: 0,
                        padding: "0.3em 0.3em",
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
                                    <SparkBarTimeSeriesValue
                                        className="current"
                                        value={this.grapher.mapTransform.formatTooltipValue(
                                            tooltipDatum.value
                                        )}
                                        formattedDate={formatYearFn(
                                            tooltipDatum.time as number
                                        )}
                                        valueColor={
                                            renderSparkBars ? barColor : "black"
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        `No data for ${formatYearFn(inputTime as number)}`
                    )}
                </div>
                {isEntityClickable && (
                    <div>
                        <p
                            style={{
                                margin: 0,
                                padding: "0.3em 0.9em",
                                fontSize: "13px",
                                opacity: 0.6,
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
