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
    formatTooltipRangeValues,
} from "../tooltip/Tooltip"
import { MapChartManager, MapColumnInfo } from "./MapChartConstants"
import { ColorScale } from "../color/ColorScale"
import {
    Time,
    EntityName,
    OwidVariableRow,
    AxisConfigInterface,
    ColumnSlug,
    PrimitiveType,
} from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    calculateTrendDirection,
    excludeUndefined,
    PointVector,
} from "@ourworldindata/utils"
import { darkenColorForHighContrastText } from "../color/ColorUtils"
import { MapSparkline, MapSparklineManager } from "./MapSparkline.js"
import { match } from "ts-pattern"
import { MapFormatValueForTooltip } from "./MapChartState.js"

interface MapTooltipProps {
    entityName: EntityName
    manager: MapChartManager
    mapColumnSlug: ColumnSlug
    mapColumnInfo: MapColumnInfo
    position?: PointVector
    lineColorScale: ColorScale
    timeSeriesTable: OwidTable
    targetTime?: Time // show tooltip values for a specific point in time
    targetTimes?: [Time, Time] // show tooltip values for a specific time range (start and end times)
    sparklineWidth?: number
    sparklineHeight?: number
    fading?: TooltipFadeMode
    dismissTooltip?: () => void
    formatValueForTooltip: MapFormatValueForTooltip
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

    @computed get formatValueForTooltip(): MapFormatValueForTooltip {
        return this.props.formatValueForTooltip
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

    @computed
    private get formattedStartValue():
        | ReturnType<MapFormatValueForTooltip>
        | undefined {
        if (!this.startDatum) return undefined
        return this.formatValueForTooltip(this.startDatum.value)
    }

    @computed
    private get formattedEndValue():
        | ReturnType<MapFormatValueForTooltip>
        | undefined {
        if (!this.endDatum) return undefined
        return this.formatValueForTooltip(this.endDatum.value)
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
                icon: TooltipFooterIcon.Notice,
                text: makeTooltipToleranceNotice(
                    `${formattedStartTime} and ${formattedEndTime}`,
                    { plural: true }
                ),
            }

        if (endValueIsInterpolated && formattedEndTime)
            return {
                icon: TooltipFooterIcon.Notice,
                text: makeTooltipToleranceNotice(formattedEndTime),
            }

        if (startValueIsInterpolated && formattedStartTime)
            return {
                icon: TooltipFooterIcon.Notice,
                text: makeTooltipToleranceNotice(formattedStartTime),
            }

        return undefined
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const { mapColumn } = this

        // Only show a rounding notice for rounding to sig figs
        if (!mapColumn.roundsToSignificantFigures) return undefined

        // Don't show a rounding notice if all values are missing
        if (!this.startDatum && !this.endDatum) return undefined

        // Don't show a rounding notice if both values are formatted as category strings
        if (
            this.formattedStartValue?.isCategorical &&
            this.formattedEndValue?.isCategorical
        )
            return undefined

        return {
            icon: TooltipFooterIcon.None,
            text: makeTooltipRoundingNotice([mapColumn.numSignificantFigures], {
                plural: this.shouldShowValueRange,
            }),
        }
    }

    override render(): React.ReactElement {
        const {
            mapColumn,
            startDatum,
            endDatum,
            entityName,
            isProjection,
            lineColorScale: colorScale,
        } = this
        const { position, fading } = this.props

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
                        formattedStartValue={this.formattedStartValue}
                        formattedEndValue={this.formattedEndValue}
                        colorScale={colorScale}
                    />
                ) : (
                    <MapTooltipValue
                        mapColumn={mapColumn}
                        datum={endDatum}
                        formattedValue={this.formattedEndValue?.label}
                        colorScale={colorScale}
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
    formattedValue,
    colorScale,
    isProjection = false,
}: {
    mapColumn: CoreColumn
    datum?: OwidVariableRow<number | string>
    formattedValue?: string
    colorScale: ColorScale
    isProjection?: boolean
}): React.ReactElement {
    const color = makeTextColorForValue(datum?.value, { colorScale })

    return (
        <TooltipValue
            label={mapColumn.displayName}
            unit={mapColumn.displayUnit}
            value={formattedValue}
            color={color}
            isProjection={isProjection}
            isRoundedToSignificantFigures={mapColumn.roundsToSignificantFigures}
            labelVariant="unit-only"
        />
    )
}

function MapTooltipRangeValues({
    mapColumn,
    startDatum,
    endDatum,
    formattedStartValue,
    formattedEndValue,
    colorScale,
}: {
    mapColumn: CoreColumn
    startDatum?: OwidVariableRow<number | string>
    endDatum?: OwidVariableRow<number | string>
    formattedStartValue?: ReturnType<MapFormatValueForTooltip>
    formattedEndValue?: ReturnType<MapFormatValueForTooltip>
    colorScale: ColorScale
}): React.ReactElement {
    const hasCategoricalValueLabels =
        formattedStartValue?.isCategorical || formattedEndValue?.isCategorical

    const colors = [
        makeTextColorForValue(startDatum?.value, { colorScale }),
        makeTextColorForValue(endDatum?.value, { colorScale }),
    ]

    const values = hasCategoricalValueLabels
        ? [formattedStartValue?.label, formattedEndValue?.label]
        : [startDatum?.value, endDatum?.value]

    return (
        <TooltipValueRange
            label={mapColumn.displayName}
            unit={mapColumn.displayUnit}
            values={formatTooltipRangeValues(values, mapColumn)}
            colors={colors}
            trend={calculateTrendDirection(...values) ?? "right"}
            isRoundedToSignificantFigures={mapColumn.roundsToSignificantFigures}
            labelVariant="unit-only"
        />
    )
}

function makeTextColorForValue(
    value: PrimitiveType | undefined,
    { colorScale }: { colorScale: ColorScale }
): string {
    return darkenColorForHighContrastText(colorScale.getColor(value) ?? "#333")
}
