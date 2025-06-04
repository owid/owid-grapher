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
    formatValueIfCustom: (d: PrimitiveType) => string | undefined
    targetTime?: Time
    sparklineWidth?: number
    sparklineHeight?: number
    fading?: TooltipFadeMode
    dismissTooltip?: () => void
    timeseriesTable: OwidTable
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

    @computed get targetTime(): Time | undefined {
        return this.props.targetTime
    }

    // Table pre-filtered by targetTime, excludes time series
    @computed private get entityTable(): OwidTable {
        const table =
            this.props.manager.transformedTable ?? this.props.manager.table
        return table.filterByEntityNames([this.entityName])
    }

    @computed get timeseriesTable(): OwidTable {
        return this.props.timeseriesTable
    }

    @computed get datum(): OwidVariableRow<number | string> | undefined {
        return this.targetTime !== undefined
            ? this.mapColumn.owidRowByEntityNameAndTime
                  .get(this.entityName)
                  ?.get(this.targetTime)
            : this.mapColumn.owidRows[0]
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

    @computed private get formattedTargetTime(): string | undefined {
        const { targetTime, entityTable } = this

        if (!entityTable.timeColumn.isMissing) {
            return entityTable.timeColumn.formatValue(targetTime)
        }

        return targetTime?.toString()
    }

    @computed private get tooltipSubtitle(): string | undefined {
        const { entityTable, datum } = this

        const { timeColumn } = entityTable
        const displayDatumTime =
            timeColumn && datum
                ? timeColumn.formatValue(datum?.originalTime)
                : (datum?.originalTime.toString() ?? "")

        return datum ? displayDatumTime : this.formattedTargetTime
    }

    @computed private get formattedValueLabel(): string | undefined {
        const { datum } = this

        if (!datum) return undefined

        const customValueLabel = this.props.formatValueIfCustom(datum.value)
        if (customValueLabel !== undefined) return customValueLabel

        if (isNumber(datum.value))
            return this.mapColumn?.formatValueShort(datum.value)

        return anyToString(datum.value)
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const { datum, targetTime, formattedTargetTime } = this

        if (!datum || datum.originalTime === targetTime || !formattedTargetTime)
            return undefined

        return {
            icon: TooltipFooterIcon.notice,
            text: makeTooltipToleranceNotice(formattedTargetTime),
        }
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const {
            mapColumn,
            datum,
            props: { formatValueIfCustom },
        } = this

        if (!mapColumn.roundsToSignificantFigures) return undefined

        const isValueLabelFormattedUsingMapColumn =
            datum &&
            formatValueIfCustom(datum.value) === undefined &&
            isNumber(datum.value)

        if (!isValueLabelFormattedUsingMapColumn) return undefined

        return {
            icon: TooltipFooterIcon.none,
            text: makeTooltipRoundingNotice([mapColumn.numSignificantFigures], {
                plural: false,
            }),
        }
    }

    render(): React.ReactElement {
        const { datum, lineColorScale, entityName } = this
        const { position, fading } = this.props

        const valueColor: string | undefined = darkenColorForHighContrastText(
            lineColorScale?.getColor(datum?.value) ?? "#333"
        )

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
                <TooltipValue
                    column={this.mapColumn}
                    value={this.formattedValueLabel}
                    color={valueColor}
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
