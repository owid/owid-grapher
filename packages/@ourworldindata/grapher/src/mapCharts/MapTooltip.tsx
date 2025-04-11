import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { TooltipFadeMode, TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipValue,
    makeTooltipToleranceNotice,
    makeTooltipRoundingNotice,
} from "../tooltip/Tooltip"
import { MapChartManager } from "./MapChartConstants"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    Time,
    EntityName,
    OwidVariableRow,
    AxisConfigInterface,
} from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    isNumber,
    AllKeysRequired,
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
    colorScaleManager: ColorScaleManager
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
    @computed get mapColumnSlug(): string | undefined {
        return this.props.manager.mapColumnSlug
    }

    @computed private get mapColumn(): CoreColumn {
        return this.mapTable.get(this.mapColumnSlug)
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

    @computed get lineColorScale(): ColorScale {
        const oldManager = this.props.colorScaleManager
        // Make sure all ColorScaleManager props are included.
        // We can't ...rest here because I think mobx computeds aren't
        // enumerable or something.
        const newManager: AllKeysRequired<ColorScaleManager> = {
            colorScaleConfig: oldManager.colorScaleConfig,
            hasNoDataBin: oldManager.hasNoDataBin,
            defaultNoDataColor: oldManager.defaultNoDataColor,
            defaultBaseColorScheme: oldManager.defaultBaseColorScheme,
            colorScaleColumn: oldManager.colorScaleColumn,
        }
        return new ColorScale(newManager)
    }

    @computed private get showSparkline(): boolean {
        return MapSparkline.shouldShow(this)
    }

    @computed get yAxisConfig(): AxisConfigInterface | undefined {
        return this.props.manager.yAxisConfig
    }

    render(): React.ReactElement {
        const { mapTable, mapColumn, datum, lineColorScale, entityName } = this
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
            } else if (isNumber(datum.value)) {
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
