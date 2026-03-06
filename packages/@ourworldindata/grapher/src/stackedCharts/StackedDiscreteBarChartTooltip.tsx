import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined } from "@ourworldindata/utils"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"
import { DiscreteBarRow } from "./StackedDiscreteBarChartConstants.js"
import { TooltipFooterIcon, FooterItem } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
    toTooltipTableColumns,
} from "../tooltip/Tooltip"

export interface StackedDiscreteBarChartTooltipProps {
    chartState: StackedDiscreteBarChartState
    tooltipState: TooltipState<{
        entityName: string
        seriesName?: string
    }>
}

@observer
export class StackedDiscreteBarChartTooltip extends React.Component<StackedDiscreteBarChartTooltipProps> {
    @computed private get chartState(): StackedDiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get item(): DiscreteBarRow | undefined {
        const { target } = this.props.tooltipState
        if (!target) return undefined
        return this.chartState.sortedRows.find(
            ({ entityName }) => entityName === target.entityName
        )
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const { item } = this
        if (!item) return undefined

        const targetTime = this.chartState.manager.endTime
        const { timeColumn } = this.chartState.inputTable

        const hasNotice = item.bars.some(
            ({ point }) =>
                !point.missing &&
                !point.interpolated &&
                point.time !== targetTime
        )

        if (!hasNotice) return undefined

        const targetNotice = timeColumn.formatValue(targetTime)
        return {
            icon: TooltipFooterIcon.Notice,
            text: makeTooltipToleranceNotice(targetNotice),
        }
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const { formatColumn } = this.chartState
        if (!formatColumn.roundsToSignificantFigures) return undefined

        return {
            icon: TooltipFooterIcon.None,
            text: makeTooltipRoundingNotice([
                formatColumn.numSignificantFigures,
            ]),
        }
    }

    @computed private get footer(): FooterItem[] {
        return excludeUndefined([this.toleranceNotice, this.roundingNotice])
    }

    override render(): React.ReactElement | null {
        const { target, position, fading } = this.props.tooltipState
        const { item } = this

        if (!target || !item) return null

        const { formatColumn } = this.chartState
        const targetTime = this.chartState.manager.endTime
        const { timeColumn } = this.chartState.inputTable

        return (
            <Tooltip
                id="stackedDiscreteBarTooltip"
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                style={{ maxWidth: "400px" }}
                offsetX={20}
                offsetY={-16}
                title={target.entityName}
                subtitle={formatColumn.displayUnit}
                subtitleFormat="unit"
                footer={this.footer}
                dissolve={fading}
                dismiss={() => (this.props.tooltipState.target = null)}
            >
                <TooltipTable
                    columns={toTooltipTableColumns(formatColumn)}
                    totals={[item.totalValue]}
                    rows={item.bars.map((bar) => {
                        const {
                            seriesName: name,
                            color,
                            point: { value, time, missing, interpolated },
                        } = bar

                        const blurred = missing || interpolated

                        return {
                            name,
                            swatch: { color },
                            blurred,
                            focused: name === target.seriesName,
                            values: [!blurred ? value : undefined],
                            originalTime:
                                !blurred && time !== targetTime
                                    ? timeColumn.formatValue(time)
                                    : undefined,
                        }
                    })}
                />
            </Tooltip>
        )
    }
}
