import * as _ from "lodash-es"
import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { TooltipFadeMode, TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipValue,
    makeTooltipToleranceNotice,
    makeTooltipRoundingNotice,
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
    formatValueIfCustom: (d: PrimitiveType) => string | undefined
    timeSeriesTable: OwidTable
    targetTime?: Time
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
        return this.mapTable.get(this.mapColumnSlug)
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

    @computed get targetTime(): Time | undefined {
        return this.props.targetTime
    }

    // Table pre-filtered by targetTime, excludes time series
    @computed private get mapTable(): OwidTable {
        const table =
            this.props.manager.transformedTable ?? this.props.manager.table
        return table.filterByEntityNames([this.entityName])
    }

    @computed get timeSeriesTable(): OwidTable {
        return this.props.timeSeriesTable
    }

    @computed get datum(): OwidVariableRow<number | string> | undefined {
        return this.mapColumn.owidRows[0]
    }

    @computed private get isProjection(): boolean {
        return match(this.mapColumnInfo)
            .with({ type: "historical" }, () => false)
            .with({ type: "projected" }, () => true)
            .with(
                { type: "historical+projected" },
                (info) =>
                    this.mapTable.get(info.slugForIsProjectionColumn)
                        .owidRows[0]?.value
            )
            .exhaustive()
    }

    @computed get lineColorScale(): ColorScale {
        return this.props.lineColorScale
    }

    @computed private get showSparkline(): boolean {
        return MapSparkline.shouldShow(this)
    }

    @computed get yAxisConfig(): AxisConfigInterface | undefined {
        return this.props.manager.yAxisConfig
    }

    override render(): React.ReactElement {
        const {
            mapTable,
            mapColumn,
            datum,
            lineColorScale,
            entityName,
            isProjection,
        } = this
        const { targetTime, formatValueIfCustom, position, fading } = this.props

        const { timeColumn } = mapTable
        const displayTime = !timeColumn.isMissing
            ? timeColumn.formatValue(targetTime)
            : targetTime?.toString()
        const displayDatumTime =
            timeColumn && datum
                ? timeColumn.formatValue(datum?.originalTime)
                : (datum?.originalTime.toString() ?? "")
        const valueColor: string | undefined = darkenColorForHighContrastText(
            lineColorScale?.getColor(datum?.value) ?? "#333"
        )

        // format the value label
        let valueLabel: string | undefined,
            isValueLabelRounded = false
        if (datum) {
            const customValueLabel = formatValueIfCustom(datum.value)
            if (customValueLabel !== undefined) {
                valueLabel = customValueLabel
            } else if (_.isNumber(datum.value)) {
                valueLabel = mapColumn?.formatValueShort(datum.value)
                isValueLabelRounded = true
            } else {
                valueLabel = anyToString(datum.value)
            }
        }

        const yColumn = this.mapTable.get(this.mapColumnSlug)

        const targetNotice =
            datum && datum.originalTime !== targetTime ? displayTime : undefined
        const toleranceNotice = targetNotice
            ? {
                  icon: TooltipFooterIcon.notice,
                  text: makeTooltipToleranceNotice(targetNotice),
              }
            : undefined
        const roundingNotice =
            isValueLabelRounded && mapColumn.roundsToSignificantFigures
                ? {
                      icon: this.showSparkline
                          ? TooltipFooterIcon.significance
                          : TooltipFooterIcon.none,
                      text: makeTooltipRoundingNotice(
                          [mapColumn.numSignificantFigures],
                          { plural: false }
                      ),
                  }
                : undefined
        const footer = excludeUndefined([toleranceNotice, roundingNotice])

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
                subtitle={datum ? displayDatumTime : displayTime}
                subtitleFormat={targetNotice ? "notice" : undefined}
                footer={footer}
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                <TooltipValue
                    column={yColumn}
                    value={valueLabel}
                    color={valueColor}
                    isProjection={isProjection}
                    labelVariant="unit-only"
                    showSignificanceSuperscript={
                        !!roundingNotice &&
                        roundingNotice.icon !== TooltipFooterIcon.none
                    }
                />
                <MapSparkline
                    manager={this}
                    sparklineWidth={this.props.sparklineWidth}
                    sparklineHeight={this.props.sparklineHeight}
                />
            </Tooltip>
        )
    }
}
