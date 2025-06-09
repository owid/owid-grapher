import * as _ from "lodash-es"
import React from "react"
import { computed, makeObservable } from "mobx"
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
import { MapChartManager, MapColumnInfo } from "./MapChartConstants"
import { ColorScale } from "../color/ColorScale"
import {
    Time,
    EntityName,
    OwidVariableRow,
    AxisConfigInterface,
    ColumnSlug,
} from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    PrimitiveType,
    excludeUndefined,
    anyToString,
    PointVector,
} from "@ourworldindata/utils"
import { darkenColorForHighContrastText } from "../color/ColorUtils"
import { MapSparkline, MapSparklineManager } from "./MapSparkline.js"
import { match } from "ts-pattern"

interface MapTooltipProps {
    entityName: EntityName
    manager: MapChartManager
    mapColumnSlug: ColumnSlug
    mapColumnInfo: MapColumnInfo
    position?: PointVector
    lineColorScale: ColorScale
    timeSeriesTable: OwidTable
    shouldUseCustomLabels?: boolean
    targetTime?: Time // show tooltip values for a specific point in time
    targetTimes?: [Time, Time] // show tooltip values for a specific time range (start and end times)
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
    constructor(props: MapTooltipProps) {
        super(props)
        makeObservable(this)
    }

    @computed get mapColumnSlug(): ColumnSlug {
        return this.props.mapColumnSlug
    }

    @computed get mapColumnInfo(): MapColumnInfo {
        return this.props.mapColumnInfo
    }

    @computed private get mapColumn(): CoreColumn {
        return this.entityTable.get(this.mapColumnSlug)
    }

    @computed get mapAndYColumnAreTheSame(): boolean {
        const { mapColumnSlug } = this
        const { yColumnSlug, yColumnSlugs } = this.props.manager
        return yColumnSlugs
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

    // Table pre-filtered by targetTime, excludes time series
    @computed private get entityTable(): OwidTable {
        const table =
            this.props.manager.transformedTable ?? this.props.manager.table
        return table.filterByEntityNames([this.entityName])
    }

    @computed get timeSeriesTable(): OwidTable {
        return this.props.timeSeriesTable
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

    @computed private get isProjection(): boolean {
        return match(this.mapColumnInfo)
            .with({ type: "historical" }, () => false)
            .with({ type: "projected" }, () => true)
            .with(
                { type: "historical+projected" },
                (info) =>
                    this.entityTable.get(info.slugForIsProjectionColumn)
                        .owidRows[0]?.value
            )
            .exhaustive()
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
        if (isStartValueLabelCategorical && isEndValueLabelCategorical)
            return undefined

        return {
            icon: TooltipFooterIcon.none,
            text: makeTooltipRoundingNotice([mapColumn.numSignificantFigures], {
                plural: this.shouldShowValueRange,
            }),
        }
    }

    render(): React.ReactElement {
        const {
            mapColumn,
            startDatum,
            endDatum,
            entityName,
            isProjection,
            lineColorScale: colorScale,
        } = this
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
                        mapColumn={mapColumn}
                        startDatum={startDatum}
                        endDatum={endDatum}
                        colorScale={colorScale}
                        shouldUseCustomLabel={shouldUseCustomLabels}
                    />
                ) : (
                    <MapTooltipValue
                        mapColumn={mapColumn}
                        datum={endDatum}
                        colorScale={colorScale}
                        shouldUseCustomLabel={shouldUseCustomLabels}
                        isProjection={isProjection}
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

function MapTooltipValue({
    mapColumn,
    datum,
    colorScale,
    isProjection = false,
    shouldUseCustomLabel,
}: {
    mapColumn: CoreColumn
    datum?: OwidVariableRow<number | string>
    colorScale: ColorScale
    isProjection?: boolean
    shouldUseCustomLabel?: boolean
}): React.ReactElement {
    const formattedValue = formatValueShort(datum?.value, {
        mapColumn,
        shouldUseCustomLabel,
        colorScale,
    })
    const color = makeTextColorForValue(datum?.value, { colorScale })

    return (
        <TooltipValue
            column={mapColumn}
            value={formattedValue}
            color={color}
            isProjection={isProjection}
        />
    )
}

function MapTooltipRangeValues({
    mapColumn,
    startDatum,
    endDatum,
    colorScale,
    shouldUseCustomLabel,
}: {
    mapColumn: CoreColumn
    startDatum?: OwidVariableRow<number | string>
    endDatum?: OwidVariableRow<number | string>
    colorScale: ColorScale
    shouldUseCustomLabel?: boolean
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

    const formattedStartValue = formatValueShort(startDatum?.value, {
        mapColumn,
        shouldUseCustomLabel,
        colorScale,
    })
    const formattedEndValue = formatValueShort(endDatum?.value, {
        mapColumn,
        shouldUseCustomLabel,
        colorScale,
    })

    const colors = [
        makeTextColorForValue(startDatum?.value, { colorScale }),
        makeTextColorForValue(endDatum?.value, { colorScale }),
    ]

    const values = hasCategoricalValueLabels
        ? [formattedStartValue, formattedEndValue]
        : [startDatum?.value, endDatum?.value]

    return (
        <TooltipValueRange column={mapColumn} values={values} colors={colors} />
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
    if (customLabel) return customLabel

    if (_.isNumber(value)) return mapColumn.formatValueShort(value)
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
    return !_.isNumber(value) || hasCustomLabel
}

function makeTextColorForValue(
    value: PrimitiveType | undefined,
    { colorScale }: { colorScale: ColorScale }
): string {
    return darkenColorForHighContrastText(colorScale.getColor(value) ?? "#333")
}
