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
import { MapChartOptionsProvider, ChoroplethMark } from "./MapChartConstants"
import { ColorScale } from "grapher/color/ColorScale"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"

interface MapTooltipProps {
    tooltipDatum?: ChoroplethMark
    tooltipTarget?: { x: number; y: number; featureId: string }
    isEntityClickable?: boolean
    options: MapChartOptionsProvider
    colorScale?: ColorScale
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

    @computed private get sparkBarsData() {
        const tooltipDatum = this.props.tooltipDatum
        if (!tooltipDatum) return []

        const sparkBarValues: SparkBarsDatum[] = []
        this.props.options.mapColumn?.valueByEntityNameAndTime
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

    @computed get colorScale() {
        return (
            this.props.colorScale ??
            new ColorScale({
                hasNoDataBin: false,
                categoricalValues: [],
                colorScaleConfig: new ColorScaleConfig(),
            })
        )
    }

    @computed private get renderSparkBars() {
        return this.props.options.mapIsClickable
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

    @computed private get inputTime() {
        return this.props.options.mapColumn.endTimelineTime
    }

    render() {
        const { tooltipDatum, isEntityClickable } = this.props

        const tooltipMessage = "Click to select" // todo: used to be "Click for Change over Time" when on line charts

        const timeColumn = this.props.options.table.timeColumn
        const { renderSparkBars, barColor, tooltipTarget, inputTime } = this

        const displayTime = timeColumn
            ? timeColumn.formatValue(inputTime)
            : inputTime
        const displayDatumTime =
            timeColumn && tooltipDatum
                ? timeColumn.formatValue(tooltipDatum.time)
                : tooltipDatum?.time.toString() ?? ""

        return (
            <Tooltip
                tooltipProvider={this.props.options}
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
                            {tooltipMessage}
                        </p>
                    </div>
                )}
            </Tooltip>
        )
    }
}
