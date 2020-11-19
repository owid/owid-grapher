import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { takeWhile, last, first, isMobile } from "grapher/utils/Util"
import {
    SparkBars,
    SparkBarsDatum,
    SparkBarsProps,
} from "grapher/sparkBars/SparkBars"
import { SparkBarTimeSeriesValue } from "grapher/sparkBars/SparkBarTimeSeriesValue"
import { MapChartManager, ChoroplethSeries } from "./MapChartConstants"
import { ColorScale } from "grapher/color/ColorScale"
import { Time } from "coreTable/CoreTableConstants"
import { ChartTypeName, GrapherTabOption } from "grapher/core/GrapherConstants"

interface MapTooltipProps {
    tooltipDatum?: ChoroplethSeries
    tooltipTarget?: { x: number; y: number; featureId: string }
    isEntityClickable?: boolean
    manager: MapChartManager
    colorScale?: ColorScale
    targetTime?: Time
}

@observer
export class MapTooltip extends React.Component<MapTooltipProps> {
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

    @computed get inputTable() {
        return this.props.manager.table
    }

    @computed private get mapColumnSlug() {
        return this.props.manager.mapColumnSlug
    }

    // Uses the rootTable because if a target year is set, we filter the years at the grapher level.
    // Todo: might want to do all filtering a step below the Grapher level?
    @computed private get sparkBarColumn() {
        return this.inputTable.rootTable.get(this.mapColumnSlug)
    }

    @computed private get sparkBarsData() {
        const tooltipDatum = this.props.tooltipDatum
        if (!tooltipDatum) return []

        const sparkBarValues: SparkBarsDatum[] = []
        this.sparkBarColumn.valueByEntityNameAndTime
            .get(tooltipDatum.seriesName)
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

    colorScale = this.props.colorScale ?? new ColorScale()

    @computed private get renderSparkBars() {
        return this.props.manager.mapIsClickable
    }

    @computed private get darkestColorInColorScheme() {
        const { colorScale } = this
        return colorScale.isColorSchemeInverted
            ? first(colorScale.baseColors)
            : last(colorScale.baseColors)
    }

    @computed private get barColor() {
        const { colorScale } = this
        return colorScale.singleColorScale &&
            !colorScale.customNumericColorsActive
            ? this.darkestColorInColorScheme
            : undefined
    }

    @computed private get tooltipTarget() {
        return (
            this.props.tooltipTarget ?? {
                x: 0,
                y: 0,
                featureId: "Default Tooltip",
            }
        )
    }

    render() {
        const {
            tooltipDatum,
            isEntityClickable,
            targetTime,
            manager,
        } = this.props

        const clickToSelectMessage =
            manager.type === ChartTypeName.LineChart
                ? "Click for change over time"
                : "Click to select"

        const { timeColumn } = this.inputTable
        const { renderSparkBars, barColor, tooltipTarget } = this

        const displayTime = !timeColumn.isMissing
            ? timeColumn.formatValue(targetTime)
            : targetTime
        const displayDatumTime =
            timeColumn && tooltipDatum
                ? timeColumn.formatValue(tooltipDatum.time)
                : tooltipDatum?.time.toString() ?? ""

        return (
            <Tooltip
                tooltipManager={this.props.manager}
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
                    {tooltipTarget.featureId ||
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
                                        value={tooltipDatum.displayValue}
                                        displayDate={displayDatumTime}
                                        valueColor={
                                            renderSparkBars ? barColor : "black"
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        `No data for ${displayTime}`
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
                            {clickToSelectMessage}
                        </p>
                    </div>
                )}
            </Tooltip>
        )
    }
}
