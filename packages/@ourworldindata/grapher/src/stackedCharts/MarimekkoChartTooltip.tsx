import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined } from "@ourworldindata/utils"
import { ColumnTypeMap } from "@ourworldindata/core-table"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { Item, Bar } from "./MarimekkoChartConstants"
import { TooltipFooterIcon, FooterItem } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipValue,
    TooltipState,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
} from "../tooltip/Tooltip"

export interface MarimekkoChartTooltipProps {
    chartState: MarimekkoChartState
    tooltipState: TooltipState<{ entityName: string }>
}

interface YValue {
    name: string
    value: number | undefined
    column: ReturnType<MarimekkoChartState["transformedTable"]["get"]>
    originalTime: string | undefined
}

@observer
export class MarimekkoChartTooltip extends React.Component<MarimekkoChartTooltipProps> {
    @computed private get chartState(): MarimekkoChartState {
        return this.props.chartState
    }

    @computed private get tooltipItem(): Item | undefined {
        const { target } = this.props.tooltipState
        return (
            target &&
            this.chartState.items.find(
                ({ entityName }) => entityName === target.entityName
            )
        )
    }

    @computed private get yValues(): YValue[] {
        const { tooltipItem } = this
        if (!tooltipItem) return []

        const endTime = this.chartState.manager.endTime

        return tooltipItem.bars.map((bar: Bar) => {
            const column = this.chartState.transformedTable.get(bar.columnSlug)

            const shouldShowYTimeNotice =
                bar.yPoint.value !== undefined && bar.yPoint.time !== endTime

            return {
                name: bar.seriesName,
                value: bar.yPoint.value,
                column,
                originalTime: shouldShowYTimeNotice
                    ? column.formatTime(bar.yPoint.time)
                    : undefined,
            }
        })
    }

    @computed private get xOriginalTimeFormatted(): string | undefined {
        const { tooltipItem } = this
        if (!tooltipItem) return undefined

        const { xColumn } = this.chartState
        const endTime = this.chartState.manager.endTime
        const xOverrideTime = this.chartState.manager.xOverrideTime

        const shouldShowXTimeNotice =
            tooltipItem.xPoint &&
            tooltipItem.xPoint.time !== endTime &&
            xOverrideTime === undefined

        if (!shouldShowXTimeNotice || !tooltipItem.xPoint) return undefined

        return xColumn?.formatTime(tooltipItem.xPoint.time)
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const endTime = this.chartState.manager.endTime
        const { timeColumn } = this.chartState.inputTable

        const xOriginalTime = this.xOriginalTimeFormatted !== undefined
        const hasYNotice = this.yValues.some(
            ({ originalTime }) => !!originalTime
        )

        if (!xOriginalTime && !hasYNotice) return undefined

        const targetNotice = timeColumn.formatValue(endTime)
        return {
            icon: TooltipFooterIcon.Notice,
            text: makeTooltipToleranceNotice(targetNotice),
        }
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const { xColumn, yColumns } = this.chartState
        const columns = excludeUndefined([xColumn, ...yColumns])

        const allRoundedToSigFigs = columns.every(
            (column) => column.roundsToSignificantFigures
        )
        const anyRoundedToSigFigs = columns.some(
            (column) => column.roundsToSignificantFigures
        )

        if (!anyRoundedToSigFigs) return undefined

        const sigFigs = excludeUndefined(
            columns.map((column) =>
                column.roundsToSignificantFigures
                    ? column.numSignificantFigures
                    : undefined
            )
        )

        return {
            icon: allRoundedToSigFigs
                ? TooltipFooterIcon.None
                : TooltipFooterIcon.Significance,
            text: makeTooltipRoundingNotice(sigFigs, {
                plural: sigFigs.length > 1,
            }),
        }
    }

    @computed private get showSignificanceSuperscript(): boolean {
        return (
            !!this.roundingNotice &&
            this.roundingNotice.icon !== TooltipFooterIcon.None
        )
    }

    @computed private get footer(): FooterItem[] {
        return excludeUndefined([this.toleranceNotice, this.roundingNotice])
    }

    override render(): React.ReactElement | null {
        const { target, position, fading } = this.props.tooltipState
        const { tooltipItem, yValues, showSignificanceSuperscript } = this

        if (!target || !tooltipItem) return null

        const { xColumn, colorColumn, colorScale } = this.chartState
        const endTime = this.chartState.manager.endTime
        const { timeColumn } = this.chartState.inputTable

        return (
            <Tooltip
                id="marimekkoTooltip"
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                style={{ maxWidth: "250px" }}
                offsetX={20}
                offsetY={-16}
                title={tooltipItem.entityName}
                subtitle={timeColumn.formatValue(endTime)}
                footer={this.footer}
                dissolve={fading}
                dismiss={() => (this.props.tooltipState.target = null)}
            >
                {yValues.map(({ name, value, column, originalTime }) => (
                    <TooltipValue
                        key={name}
                        label={column.displayName}
                        unit={column.displayUnit}
                        value={column.formatValueShort(value)}
                        originalTime={originalTime}
                        isRoundedToSignificantFigures={
                            column.roundsToSignificantFigures
                        }
                        showSignificanceSuperscript={
                            showSignificanceSuperscript
                        }
                    />
                ))}
                {xColumn && !xColumn.isMissing && (
                    <TooltipValue
                        label={xColumn.displayName}
                        unit={xColumn.displayUnit}
                        value={xColumn.formatValueShort(
                            tooltipItem.xPoint?.value
                        )}
                        originalTime={this.xOriginalTimeFormatted}
                        isRoundedToSignificantFigures={
                            xColumn.roundsToSignificantFigures
                        }
                        showSignificanceSuperscript={
                            showSignificanceSuperscript
                        }
                    />
                )}
                {colorColumn &&
                    !colorColumn.isMissing &&
                    tooltipItem.entityColor &&
                    !(colorColumn instanceof ColumnTypeMap.Continent) && (
                        <TooltipValue
                            label={
                                colorScale.legendDescription ??
                                colorColumn.displayName
                            }
                            value={
                                colorScale.getBinForValue(
                                    tooltipItem.entityColor.colorDomainValue
                                )?.label ??
                                tooltipItem.entityColor.colorDomainValue
                            }
                        />
                    )}
            </Tooltip>
        )
    }
}
