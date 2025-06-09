import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    FooterItem,
    TooltipFadeMode,
    TooltipFooterIcon,
} from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipValue,
    makeTooltipToleranceNotice,
    makeTooltipRoundingNotice,
    TooltipValueRange,
} from "../tooltip/Tooltip"
import { MapChartManager } from "./MapChartConstants"
import { ColorScale } from "../color/ColorScale"
import {
    Time,
    EntityName,
    OwidVariableRow,
    AxisConfigInterface,
} from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    isNumber,
    PrimitiveType,
    excludeUndefined,
    anyToString,
    PointVector,
} from "@ourworldindata/utils"
import { darkenColorForHighContrastText } from "../color/ColorUtils"
import { MapSparkline, MapSparklineManager } from "./MapSparkline.js"

interface MapTooltipProps {
    entityName: EntityName
    manager: MapChartManager
    position?: PointVector
    lineColorScale: ColorScale
    shouldUseCustomLabels?: boolean
    targetTime?: Time // show values at a specific time
    targetTimes?: [Time, Time] // show values at a specific time range
    sparklineWidth?: number
    sparklineHeight?: number
    fading?: TooltipFadeMode
    dismissTooltip?: () => void
}

@observer
export class MapTooltip
    extends React.Component<MapTooltipProps>
    implements MapSparklineManager
{
    @computed get mapColumnSlug(): string | undefined {
        return this.props.manager.mapColumnSlug
    }

    @computed private get mapColumn(): CoreColumn {
        return this.entityTable.get(this.mapColumnSlug)
    }

    @computed get mapAndYColumnAreTheSame(): boolean {
        const { yColumnSlug, yColumnSlugs, mapColumnSlug } = this.props.manager
        return yColumnSlugs && mapColumnSlug !== undefined
            ? yColumnSlugs.includes(mapColumnSlug)
            : yColumnSlug === mapColumnSlug
    }

    @computed get entityName(): EntityName {
        return this.props.entityName
    }

    @computed private get shouldShowValueRange(): boolean {
        return (
            this.props.targetTimes !== undefined &&
            // If both values are missing, we simply show a 'No data' tooltip
            (this.startDatum?.value !== undefined ||
                this.endDatum?.value !== undefined)
        )
    }

    @computed private get startTime(): Time | undefined {
        return this.props.targetTimes?.[0]
    }

    @computed private get endTime(): Time | undefined {
        return this.props.targetTimes?.[1] ?? this.props.targetTime
    }

    @computed private get entityTable(): OwidTable {
        return this.table.filterByEntityNames([this.entityName])
    }

    @computed private get hasSparkline(): boolean {
        return MapSparkline.shouldShow(this)
    }

    @computed private get table(): OwidTable {
        return this.props.manager.transformedTable ?? this.props.manager.table
    }

    @computed get sparklineTable(): OwidTable {
        return this.props.manager.table
    }

    @computed private get startDatum():
        | OwidVariableRow<number | string>
        | undefined {
        if (this.startTime === undefined) return undefined
        return this.mapColumn.owidRowByEntityNameAndTime
            .get(this.entityName)
            ?.get(this.startTime)
    }

    @computed private get endDatum():
        | OwidVariableRow<number | string>
        | undefined {
        if (this.endTime === undefined) return undefined
        return this.mapColumn.owidRowByEntityNameAndTime
            .get(this.entityName)
            ?.get(this.endTime)
    }

    @computed get highlightedTimesInSparkline(): Time[] | undefined {
        if (this.props.targetTimes) {
            return [
                this.startDatum?.originalTime ?? this.props.targetTimes[0],
                this.endDatum?.originalTime ?? this.props.targetTimes[1],
            ]
        }

        if (this.props.targetTime !== undefined)
            return [this.endDatum?.originalTime ?? this.props.targetTime]

        return []
    }

    @computed get lineColorScale(): ColorScale {
        return this.props.lineColorScale
    }

    @computed get yAxisConfig(): AxisConfigInterface | undefined {
        return this.props.manager.yAxisConfig
    }

    private formatTime(time?: Time): string | undefined {
        if (time === undefined) return undefined

        if (!this.entityTable.timeColumn.isMissing)
            return this.entityTable.timeColumn.formatValue(time)

        return time?.toString()
    }

    @computed private get tooltipSubtitle(): string | undefined {
        const { startDatum, endDatum, startTime, endTime } = this

        const originalStartTime = startDatum?.originalTime ?? startTime
        const originalEndTime = endDatum?.originalTime ?? endTime

        if (this.shouldShowValueRange) {
            return [originalStartTime, originalEndTime]
                .map((time) => this.formatTime(time))
                .join(" to ")
        }

        return this.formatTime(originalEndTime)
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const { startDatum, startTime, endDatum, endTime } = this

        const startValueIsInterpolated =
            startDatum && startDatum?.originalTime !== startTime
        const endValueIsInterpolated =
            endDatum && endDatum?.originalTime !== endTime

        const formattedStartTime = this.formatTime(this.startTime)
        const formattedEndTime = this.formatTime(this.endTime)

        if (startValueIsInterpolated && endValueIsInterpolated)
            return {
                icon: TooltipFooterIcon.notice,
                text: makeTooltipToleranceNotice(
                    `${formattedStartTime} and ${formattedEndTime}`,
                    { plural: true }
                ),
            }

        if (endValueIsInterpolated && formattedEndTime)
            return {
                icon: TooltipFooterIcon.notice,
                text: makeTooltipToleranceNotice(formattedEndTime),
            }

        if (startValueIsInterpolated && formattedStartTime)
            return {
                icon: TooltipFooterIcon.notice,
                text: makeTooltipToleranceNotice(formattedStartTime),
            }

        return undefined
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const {
            mapColumn,
            lineColorScale: colorScale,
            props: { shouldUseCustomLabels: shouldUseCustomLabel },
        } = this

        // Only show a rounding notice for rounding to sig figs
        if (!mapColumn.roundsToSignificantFigures) return undefined

        // Don't show a rounding notice if all values are missing
        if (!this.startDatum && !this.endDatum) return undefined

        const isStartValueLabelCategorical = hasCategoricalValueLabel(
            this.startDatum?.value,
            { shouldUseCustomLabel, colorScale }
        )
        const isEndValueLabelCategorical = hasCategoricalValueLabel(
            this.endDatum?.value,
            { shouldUseCustomLabel, colorScale }
        )

        // Don't show a rounding notice if values are formatted as category strings
        if (isStartValueLabelCategorical || isEndValueLabelCategorical)
            return undefined

        return {
            icon: TooltipFooterIcon.none,
            text: makeTooltipRoundingNotice([mapColumn.numSignificantFigures], {
                plural: this.shouldShowValueRange,
            }),
        }
    }

    render(): React.ReactElement {
        const { entityName } = this
        const { position, fading, shouldUseCustomLabels } = this.props

        const footer = excludeUndefined([
            this.toleranceNotice,
            this.roundingNotice,
        ])

        return (
            <Tooltip
                id="mapTooltip"
                tooltipManager={this.props.manager}
                key="mapTooltip"
                x={position?.x}
                y={position?.y}
                style={{ maxWidth: "250px" }}
                offsetX={20}
                offsetY={-16}
                offsetYDirection={"downward"}
                title={entityName}
                subtitle={this.tooltipSubtitle}
                subtitleFormat={this.toleranceNotice ? "notice" : undefined}
                footer={footer}
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                {this.shouldShowValueRange ? (
                    <MapTooltipRangeValues
                        mapColumn={this.mapColumn}
                        startTime={this.startTime}
                        endTime={this.endTime}
                        startDatum={this.startDatum}
                        endDatum={this.endDatum}
                        colorScale={this.lineColorScale}
                        shouldUseCustomLabel={shouldUseCustomLabels}
                        hasSparkline={this.hasSparkline}
                    />
                ) : (
                    <MapTooltipValue
                        mapColumn={this.mapColumn}
                        targetTime={this.endTime}
                        datum={this.endDatum}
                        colorScale={this.lineColorScale}
                        shouldUseCustomLabel={shouldUseCustomLabels}
                    />
                )}
                <MapSparkline
                    manager={this}
                    sparklineWidth={this.props.sparklineWidth}
                    sparklineHeight={this.props.sparklineHeight}
                />
            </Tooltip>
        )
    }
}

function MapTooltipRangeValues({
    mapColumn,
    startTime,
    endTime,
    startDatum,
    endDatum,
    colorScale,
    shouldUseCustomLabel,
    hasSparkline,
}: {
    mapColumn: CoreColumn
    startTime?: Time
    endTime?: Time
    startDatum?: OwidVariableRow<number | string>
    endDatum?: OwidVariableRow<number | string>
    colorScale: ColorScale
    shouldUseCustomLabel?: boolean
    hasSparkline?: boolean
}): React.ReactElement {
    const isStartValueLabelCategorical = hasCategoricalValueLabel(
        startDatum?.value,
        { shouldUseCustomLabel, colorScale }
    )
    const isEndValueLabelCategorical = hasCategoricalValueLabel(
        endDatum?.value,
        { shouldUseCustomLabel, colorScale }
    )

    const hasCategoricalValueLabels =
        isStartValueLabelCategorical || isEndValueLabelCategorical

    // if (hasCategoricalValueLabels && !hasSparkline)
    //     return (
    //         <>
    //             <MapTooltipValue
    //                 mapColumn={mapColumn}
    //                 targetTime={startTime}
    //                 datum={startDatum}
    //                 colorScale={colorScale}
    //                 shouldUseCustomLabel={shouldUseCustomLabel}
    //                 shouldShowTimeAndTimeNotice
    //             />
    //             <MapTooltipValue
    //                 mapColumn={mapColumn}
    //                 targetTime={endTime}
    //                 datum={endDatum}
    //                 colorScale={colorScale}
    //                 shouldUseCustomLabel={shouldUseCustomLabel}
    //                 shouldShowTimeAndTimeNotice
    //             />
    //         </>
    //     )

    if (hasCategoricalValueLabels)
        return (
            <TooltipValueRange
                column={mapColumn}
                values={[
                    formatValueShort(startDatum?.value, {
                        mapColumn,
                        shouldUseCustomLabel,
                        colorScale,
                    }),
                    formatValueShort(endDatum?.value, {
                        mapColumn,
                        shouldUseCustomLabel,
                        colorScale,
                    }),
                ]}
                colors={[
                    darkenColorForHighContrastText(
                        colorScale.getColor(startDatum?.value) ?? "#333"
                    ),
                    darkenColorForHighContrastText(
                        colorScale.getColor(endDatum?.value) ?? "#333"
                    ),
                ]}
            />
        )

    return (
        <TooltipValueRange
            column={mapColumn}
            values={[startDatum?.value, endDatum?.value]}
            colors={[
                darkenColorForHighContrastText(
                    colorScale.getColor(startDatum?.value) ?? "#333"
                ),
                darkenColorForHighContrastText(
                    colorScale.getColor(endDatum?.value) ?? "#333"
                ),
            ]}
        />
    )
}

function MapTooltipValue({
    mapColumn,
    targetTime,
    datum,
    colorScale,
    shouldUseCustomLabel,
    shouldShowTimeAndTimeNotice,
}: {
    mapColumn: CoreColumn
    targetTime?: number
    datum?: OwidVariableRow<number | string>
    colorScale: ColorScale
    shouldUseCustomLabel?: boolean
    shouldShowTimeAndTimeNotice?: boolean
}): React.ReactElement {
    const formattedValue = formatValueShort(datum?.value, {
        mapColumn,
        shouldUseCustomLabel,
        colorScale,
    })
    const color = darkenColorForHighContrastText(
        colorScale.getColor(datum?.value) ?? "#333"
    )

    const isInterpolated = datum && datum?.originalTime !== targetTime
    const time = shouldShowTimeAndTimeNotice
        ? (datum?.originalTime ?? targetTime)
        : undefined
    const notice = shouldShowTimeAndTimeNotice
        ? isInterpolated
            ? datum?.originalTime
            : undefined
        : undefined

    return (
        <TooltipValue
            column={mapColumn}
            value={formattedValue}
            time={time}
            notice={notice}
            color={color}
        />
    )
}

function formatValueShort(
    value: PrimitiveType | undefined,
    {
        mapColumn,
        shouldUseCustomLabel,
        colorScale,
    }: {
        mapColumn: CoreColumn
        shouldUseCustomLabel?: boolean
        colorScale: ColorScale
    }
): string | undefined {
    if (value === undefined) return undefined

    const customLabel = formatValueIfCustom(value, {
        shouldUseCustomLabel,
        colorScale,
    })
    console.log("custom", customLabel)
    if (customLabel) return customLabel

    if (isNumber(value)) return mapColumn.formatValueShort(value)
    return anyToString(value)
}

function formatValueIfCustom(
    value: PrimitiveType,
    {
        shouldUseCustomLabel,
        colorScale,
    }: { shouldUseCustomLabel?: boolean; colorScale: ColorScale }
): string | undefined {
    if (!shouldUseCustomLabel) return undefined
    // Find the bin (and its label) that this value belongs to
    const bin = colorScale.getBinForValue(value)
    const label = bin?.label
    if (label !== undefined && label !== "") return label
    return undefined
}

function hasCategoricalValueLabel(
    value: PrimitiveType | undefined,
    {
        shouldUseCustomLabel,
        colorScale,
    }: { shouldUseCustomLabel?: boolean; colorScale: ColorScale }
): boolean {
    if (value === undefined) return false
    const hasCustomLabel =
        formatValueIfCustom(value, {
            shouldUseCustomLabel,
            colorScale,
        }) !== undefined
    return !isNumber(value) || hasCustomLabel
}
