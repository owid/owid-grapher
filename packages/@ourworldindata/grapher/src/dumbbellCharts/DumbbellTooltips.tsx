import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    calculateTrendDirection,
    excludeUndefined,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { DumbbellValueLabelMode } from "@ourworldindata/types"
import {
    formatTooltipRangeValues,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
    Tooltip,
    TooltipState,
    TooltipValue,
    TooltipValueRange,
} from "../tooltip/Tooltip"
import { FooterItem, TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import { GRAY_90 } from "../color/ColorConstants.js"
import { DumbbellChartState } from "./DumbbellChartState"
import { SizedDumbbellSeries } from "./DumbbellChartConstants"
import { match } from "ts-pattern"

interface DumbbellTooltipProps {
    id: number
    chartState: DumbbellChartState
    tooltipState: TooltipState<{ seriesName: string }>
    series: SizedDumbbellSeries[]
    dismissTooltip: () => void
}

@observer
export class DumbbellTimeRangeTooltip extends React.Component<DumbbellTooltipProps> {
    constructor(props: DumbbellTooltipProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get chartState(): DumbbellChartState {
        return this.props.chartState
    }

    @computed private get target(): SizedDumbbellSeries | undefined {
        const seriesName = this.props.tooltipState.target?.seriesName
        if (!seriesName) return undefined
        return this.props.series.find((s) => s.seriesName === seriesName)
    }

    @computed private get subtitle(): string {
        const { formatColumn, startTime, endTime } = this.chartState
        const { target } = this

        const originalStartTime = target?.start.time ?? startTime
        const originalEndTime = target?.end.time ?? endTime

        const formattedStartTime = formatColumn.formatTime(originalStartTime)
        const formattedEndTime = formatColumn.formatTime(originalEndTime)

        return `${formattedStartTime} to ${formattedEndTime}`
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const { target } = this
        if (!target) return undefined

        const { formatColumn, startTime, endTime } = this.chartState
        const isStartOriginal = target.start.time === startTime
        const isEndOriginal = target.end.time === endTime

        if (isStartOriginal && isEndOriginal) return undefined

        const formatTime = (t: number) => formatColumn.formatTime(t)
        const targetYear =
            !isStartOriginal && !isEndOriginal
                ? `${formatTime(startTime)} and ${formatTime(endTime)}`
                : !isStartOriginal
                  ? formatTime(startTime)
                  : formatTime(endTime)

        return {
            icon: TooltipFooterIcon.Notice,
            text: makeTooltipToleranceNotice(targetYear, {
                plural: !isStartOriginal && !isEndOriginal,
            }),
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

    override render(): React.ReactElement | null {
        const { target } = this
        const { position, fading } = this.props.tooltipState
        if (!target) return null

        const { formatColumn } = this.chartState
        const values: [number, number] = [target.start.value, target.end.value]
        const footer = excludeUndefined([
            this.toleranceNotice,
            this.roundingNotice,
        ])

        return (
            <Tooltip
                id={this.props.id}
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "300px" }}
                title={target.displayName}
                subtitle={this.subtitle}
                subtitleFormat={this.toleranceNotice ? "notice" : undefined}
                footer={footer}
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                <TooltipValueRange
                    label={formatColumn.displayName}
                    unit={formatColumn.displayUnit}
                    values={formatTooltipRangeValues(values, formatColumn)}
                    trend={calculateTrendDirection(...values, (value) =>
                        formatColumn.formatValueShort(value)
                    )}
                    arrowColor={target.color}
                    labelVariant="unit-only"
                />
            </Tooltip>
        )
    }
}

@observer
export class DumbbellTwoColumnTooltip extends React.Component<DumbbellTooltipProps> {
    constructor(props: DumbbellTooltipProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get chartState(): DumbbellChartState {
        return this.props.chartState
    }

    @computed private get target(): SizedDumbbellSeries | undefined {
        const seriesName = this.props.tooltipState.target?.seriesName
        if (!seriesName) return undefined
        return this.props.series.find((s) => s.seriesName === seriesName)
    }

    @computed private get columns(): [CoreColumn, CoreColumn] {
        const [startColumn, endColumn] = this.chartState.yColumns
        return [startColumn, endColumn]
    }

    @computed private get subtitle(): string {
        const { formatColumn, endTime } = this.chartState
        return formatColumn.formatTime(endTime)
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const { target } = this
        if (!target) return undefined

        const { formatColumn, endTime } = this.chartState
        const isStartOriginal = target.start.time === endTime
        const isEndOriginal = target.end.time === endTime

        if (isStartOriginal && isEndOriginal) return undefined

        return {
            icon: TooltipFooterIcon.Notice,
            text: makeTooltipToleranceNotice(formatColumn.formatTime(endTime)),
        }
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const entries = excludeUndefined([...this.columns, this.changeRow])

        const allRoundedToSigFigs = entries.every(
            (entry) => entry.roundsToSignificantFigures
        )
        const anyRoundedToSigFigs = entries.some(
            (entry) => entry.roundsToSignificantFigures
        )

        if (!anyRoundedToSigFigs) return undefined

        const sigFigs = excludeUndefined(
            entries.map((entry) =>
                entry.roundsToSignificantFigures
                    ? entry.numSignificantFigures
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

    @computed private get showSignificanceSuperscriptIfApplicable(): boolean {
        return this.roundingNotice?.icon === TooltipFooterIcon.Significance
    }

    @computed private get changeRow():
        | {
              label: string
              value: string
              roundsToSignificantFigures: boolean
              numSignificantFigures: number
          }
        | undefined {
        const { valueLabelMode } = this.chartState

        const valueLabelIsChange =
            valueLabelMode === DumbbellValueLabelMode.Change ||
            valueLabelMode === DumbbellValueLabelMode.PercentChange

        if (!valueLabelIsChange) return undefined

        const value = this.target?.end.label?.text
        if (value === undefined) return undefined

        const [startColumn] = this.columns
        return match(valueLabelMode)
            .with(DumbbellValueLabelMode.Change, () => ({
                label: "Change",
                value,
                // Formatted via startColumn (= formatColumn)
                roundsToSignificantFigures:
                    startColumn.roundsToSignificantFigures,
                numSignificantFigures: startColumn.numSignificantFigures,
            }))
            .with(DumbbellValueLabelMode.PercentChange, () => ({
                label: "Percent change",
                value,
                // Formatted with numDecimalPlaces: 1
                roundsToSignificantFigures: false,
                numSignificantFigures: 0,
            }))
            .exhaustive()
    }

    override render(): React.ReactElement | null {
        const { target } = this
        const { position, fading } = this.props.tooltipState
        if (!target) return null

        const [startColumn, endColumn] = this.columns
        const { endTime } = this.chartState
        const footer = excludeUndefined([
            this.toleranceNotice,
            this.roundingNotice,
        ])

        return (
            <Tooltip
                id={this.props.id}
                tooltipManager={this.chartState.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "300px" }}
                title={target.displayName}
                subtitle={this.subtitle}
                footer={footer}
                dissolve={fading}
                dismiss={this.props.dismissTooltip}
            >
                <TooltipValue
                    label={startColumn.displayName}
                    unit={startColumn.displayUnit}
                    value={startColumn.formatValueShort(target.start.value)}
                    color={target.start.color}
                    originalTime={
                        target.start.time !== endTime
                            ? startColumn.formatTime(target.start.time)
                            : undefined
                    }
                    showSignificanceSuperscript={
                        this.showSignificanceSuperscriptIfApplicable &&
                        startColumn.roundsToSignificantFigures
                    }
                    labelVariant="label+unit"
                />
                <TooltipValue
                    label={endColumn.displayName}
                    unit={endColumn.displayUnit}
                    value={endColumn.formatValueShort(target.end.value)}
                    color={target.end.color}
                    originalTime={
                        target.end.time !== endTime
                            ? endColumn.formatTime(target.end.time)
                            : undefined
                    }
                    showSignificanceSuperscript={
                        this.showSignificanceSuperscriptIfApplicable &&
                        endColumn.roundsToSignificantFigures
                    }
                    labelVariant="label+unit"
                />
                {this.changeRow && (
                    <TooltipValue
                        label={this.changeRow.label}
                        value={this.changeRow.value}
                        color={GRAY_90}
                        showSignificanceSuperscript={
                            this.showSignificanceSuperscriptIfApplicable &&
                            this.changeRow.roundsToSignificantFigures
                        }
                    />
                )}
            </Tooltip>
        )
    }
}
