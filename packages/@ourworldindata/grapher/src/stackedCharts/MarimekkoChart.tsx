import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import {
    Bounds,
    EntityName,
    excludeUndefined,
    HorizontalAlign,
    Position,
    SortOrder,
    getRelativeMouse,
    EntitySelectionMode,
    makeFigmaId,
    dyFromAlign,
    exposeInstanceOnWindow,
} from "@ourworldindata/utils"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { DualAxisComponent } from "../axis/AxisViews"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { VerticalAlign } from "@ourworldindata/types"
import {
    OwidTable,
    CoreColumn,
    ColumnTypeMap,
} from "@ourworldindata/core-table"
import { getShortNameForEntity } from "../chart/ChartUtils"
import { LEGEND_STYLE_FOR_STACKED_CHARTS } from "./StackedConstants"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipValue,
    TooltipState,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
} from "../tooltip/Tooltip"
import { HorizontalCategoricalColorLegend } from "../legend/HorizontalCategoricalColorLegend"
import { HorizontalCategoricalColorLegendState } from "../legend/HorizontalCategoricalColorLegendState"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import {
    BinEmphasis,
    LegendStyleConfig,
    toBinEmphasis,
} from "../legend/LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    MarimekkoChartManager,
    MarimekkoNoDataArea,
    MarimekkoSeries,
    PlacedMarimekkoSeries,
    RenderMarimekkoSeries,
    MarimekkoLabelCandidate,
    PlacedMarimekkoLabel,
} from "./MarimekkoChartConstants"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { MarimekkoBars } from "./MarimekkoBars"
import {
    splitIntoEqualDomainSizeChunks,
    toMarimekkoNoDataArea,
    toPlacedMarimekkoSeries,
    toRenderMarimekkoSeries,
} from "./MarimekkoChartHelpers"

const MARKER_MARGIN: number = 4
const MARKER_AREA_HEIGHT: number = 25
const MAX_LABEL_COUNT: number = 20

/** Vertical gap between two stacked entity labels */
const LABEL_SPACING: number = 5

/** 0 is horizontal, -90 is vertical from bottom to top, ... */
const LABEL_ANGLE_IN_DEGREES: number = -45

export type MarimekkoChartProps = ChartComponentProps<MarimekkoChartState>

@observer
export class MarimekkoChart
    extends React.Component<MarimekkoChartProps>
    implements ChartInterface, AxisManager
{
    base = React.createRef<SVGGElement>()

    constructor(props: MarimekkoChartProps) {
        super(props)

        makeObservable(this, {
            focusColorBin: observable,
            tooltipState: observable,
        })
    }

    // currently hovered legend color
    focusColorBin: ColorScaleBin | undefined = undefined

    // current tooltip target & position
    tooltipState = new TooltipState<{
        entityName: string
    }>()

    @computed get chartState(): MarimekkoChartState {
        return this.props.chartState
    }

    @computed private get manager(): MarimekkoChartManager {
        return this.chartState.manager
    }

    @computed private get series(): readonly MarimekkoSeries[] {
        return this.chartState.series
    }

    @computed private get latestTime(): number | undefined {
        const { yColumnSlug } = this.chartState
        const times = yColumnSlug
            ? this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.getTimesUniqSortedAscForColumns(
                  [yColumnSlug]
              )
            : undefined

        return times ? R.last(times) : undefined
    }
    @computed private get tableAtLatestTimelineTimepoint():
        | OwidTable
        | undefined {
        if (this.latestTime)
            return this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.filterByTargetTimes(
                [this.latestTime],
                0
            )
        else return undefined
    }
    @computed private get xColumnAtLastTimePoint(): CoreColumn | undefined {
        const { xColumnSlug } = this.chartState
        if (xColumnSlug === undefined) return undefined
        if (this.tableAtLatestTimelineTimepoint)
            return this.tableAtLatestTimelineTimepoint.getColumns([
                xColumnSlug,
            ])[0]
        else return undefined
    }

    @computed private get yColumnAtLastTimePoint(): CoreColumn | undefined {
        const { yColumnSlug } = this.chartState
        if (yColumnSlug === undefined) return undefined
        return this.tableAtLatestTimelineTimepoint?.getColumns([yColumnSlug])[0]
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padRight(10)
    }

    @computed private get innerBounds(): Bounds {
        // This is a workaround to get the actual width of the vertical axis - dualAxis does this
        // internally but we can't access this.dualAxis here due to a dependency cycle
        const axis = this.verticalAxisPart.clone()
        axis.range = [0, this.bounds.height]
        const verticalAxisTrueWidth = axis.width

        const whiteSpaceOnLeft = this.bounds.left + verticalAxisTrueWidth
        const labelLinesHeight = MARKER_AREA_HEIGHT
        // only pad left by the amount the longest label would exceed whatever space the
        // vertical axis needs anyhow for label and tickmarks
        const marginToEnsureWidestEntityLabelFitsEvenIfAtX0 =
            Math.max(whiteSpaceOnLeft, this.longestLabelWidth) -
            whiteSpaceOnLeft
        return this.bounds
            .padBottom(this.longestLabelHeight + 2)
            .padBottom(labelLinesHeight)
            .padTop(
                this.showLegend
                    ? this.legendState.height + this.legendPaddingTop
                    : 0
            )
            .padLeft(marginToEnsureWidestEntityLabelFitsEvenIfAtX0)
    }

    @computed private get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get xRange(): [number, number] {
        return [this.bounds.left, this.bounds.right]
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xColumnSlug } = this.chartState
        return new AxisConfig(
            {
                ...this.manager.xAxisConfig,
                orient: Position.top,
                hideAxis: xColumnSlug === undefined,
                hideGridlines: xColumnSlug === undefined,
            },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
            comparisonLines: this.manager.comparisonLines,
        })
    }

    @computed get placedSeries(): PlacedMarimekkoSeries[] {
        const { x0, y0, sortedSeries } = this.chartState
        return toPlacedMarimekkoSeries(sortedSeries, {
            x0,
            y0,
            dualAxis: this.dualAxis,
        })
    }

    @computed private get hoveredEntityName(): string | undefined {
        const { target, fading } = this.tooltipState
        return target && !fading ? target.entityName : undefined
    }

    @computed private get renderSeries(): RenderMarimekkoSeries[] {
        return toRenderMarimekkoSeries(this.placedSeries, {
            hoveredEntityName: this.hoveredEntityName,
            selectedEntityNames: this.chartState.selectionArray.selectedSet,
            focusColorBin: this.focusColorBin,
        })
    }

    @computed private get noDataArea(): MarimekkoNoDataArea | undefined {
        return toMarimekkoNoDataArea(this.placedSeries)
    }

    @computed private get placedSeriesByEntityName(): Map<
        string,
        PlacedMarimekkoSeries
    > {
        return new Map(
            this.placedSeries.map((series) => [series.entityName, series])
        )
    }

    // legend props

    @computed private get legendPaddingTop(): number {
        return this.legendState.height > 0 ? this.fontSize : 0
    }

    @computed private get legendWidth(): number {
        return this.bounds.width
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    @computed private get categoricalLegendData(): CategoricalBin[] {
        if (!this.chartState.colorColumnSlug) return []
        return this.chartState.colorScale.categoricalLegendBins
    }

    private readonly resolveLegendBinEmphasis = (
        bin: ColorScaleBin
    ): Emphasis => {
        const { focusColorBin } = this

        // If nothing is focused, all items are active
        if (!focusColorBin && this.hoverColors.length === 0)
            return Emphasis.Default

        const isHovered = this.hoverColors?.includes(bin.color)
        if (isHovered) return Emphasis.Highlighted

        // Check if this bin matches the focused color bin
        const isFocused = focusColorBin && bin.equals(focusColorBin)
        return isFocused ? Emphasis.Highlighted : Emphasis.Muted
    }

    @computed private get categoricalLegendEmphasis(): BinEmphasis {
        return toBinEmphasis(
            this.categoricalLegendData,
            this.resolveLegendBinEmphasis
        )
    }

    legendStyleConfig: LegendStyleConfig = LEGEND_STYLE_FOR_STACKED_CHARTS

    @computed get hoverColors(): string[] {
        if (this.focusColorBin) return [this.focusColorBin.color]
        if (this.tooltipSeries?.entityColor)
            return [this.tooltipSeries.entityColor.color]
        const { selectionArray } = this.chartState
        if (selectionArray.hasSelection) {
            const selectedSeries = this.series.filter((series) =>
                selectionArray.selectedSet.has(series.entityName)
            )
            const uniqueSelectedColors = new Set(
                selectedSeries.map((series) => series.entityColor?.color)
            )
            return this.categoricalLegendData
                .filter((bin) => uniqueSelectedColors.has(bin.color as any))
                .map((bin) => bin.color)
        }
        return []
    }

    @computed private get showLegend(): boolean {
        return !!this.chartState.colorColumnSlug && !!this.manager.showLegend
    }

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.focusColorBin = bin
    }

    @action.bound onLegendMouseLeave(): void {
        this.focusColorBin = undefined
    }

    @computed private get legendState(): HorizontalCategoricalColorLegendState {
        return new HorizontalCategoricalColorLegendState(
            this.categoricalLegendData,
            {
                fontSize: this.fontSize,
                width: this.legendWidth,
                align: HorizontalAlign.left,
            }
        )
    }

    @action.bound private onEntityMouseOver(entityName: string): void {
        this.tooltipState.target = { entityName }
    }

    @action.bound private onMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @action.bound private dismissTooltip(): void {
        this.tooltipState.target = null
    }

    @action.bound private onEntityClick(entityName: string): void {
        this.onSelectEntity(entityName)
    }

    @action.bound private onSelectEntity(entityName: string): void {
        if (this.canAddCountry)
            this.chartState.selectionArray.toggleSelection(entityName)
    }
    @computed private get canAddCountry(): boolean {
        const { addCountryMode } = this.manager
        return (addCountryMode &&
            addCountryMode !== EntitySelectionMode.Disabled) as boolean
    }

    @computed private get tooltipSeries(): MarimekkoSeries | undefined {
        const { target } = this.tooltipState
        return (
            target &&
            this.series.find(
                ({ entityName }) => entityName === target.entityName
            )
        )
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataMessage
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        const {
            manager,
            bounds,
            dualAxis,
            tooltipSeries,
            manager: { endTime, xOverrideTime },
            tooltipState: { target, position, fading },
        } = this
        const { xColumn, yColumn, colorColumn, colorScale } = this.chartState
        const { timeColumn } = this.chartState.inputTable

        const { entityName, xPoint, yPoint } = tooltipSeries ?? {}

        const yOriginalTimeFormatted =
            yPoint && yPoint.time !== endTime
                ? yColumn.formatTime(yPoint.time)
                : undefined

        // TODO: when we have proper time support to work across date/year variables then
        // this should be set properly and the x axis time be passed in on it's own.
        // For now we disable x axis notices when the xOverrideTime is set which is
        // usually the case when matching day and year variables
        const shouldShowXTimeNotice =
            xPoint && xPoint.time !== endTime && xOverrideTime === undefined
        const xOriginalTime = shouldShowXTimeNotice ? xPoint?.time : undefined
        const xOriginalTimeFormatted = xOriginalTime
            ? xColumn?.formatTime(xOriginalTime)
            : undefined
        const targetNotice =
            xOriginalTime || yOriginalTimeFormatted
                ? timeColumn.formatValue(endTime)
                : undefined
        const toleranceNotice = targetNotice
            ? {
                  icon: TooltipFooterIcon.Notice,
                  text: makeTooltipToleranceNotice(targetNotice),
              }
            : undefined

        const columns = excludeUndefined([xColumn, yColumn])
        const allRoundedToSigFigs = columns.every(
            (column) => column.roundsToSignificantFigures
        )
        const anyRoundedToSigFigs = columns.some(
            (column) => column.roundsToSignificantFigures
        )
        const sigFigs = excludeUndefined(
            columns.map((column) =>
                column.roundsToSignificantFigures
                    ? column.numSignificantFigures
                    : undefined
            )
        )
        const roundingNotice = anyRoundedToSigFigs
            ? {
                  icon: allRoundedToSigFigs
                      ? TooltipFooterIcon.None
                      : TooltipFooterIcon.Significance,
                  text: makeTooltipRoundingNotice(sigFigs, {
                      plural: sigFigs.length > 1,
                  }),
              }
            : undefined
        const showSignificanceSuperscriptIfApplicable =
            !!roundingNotice && roundingNotice.icon !== TooltipFooterIcon.None

        const footer = excludeUndefined([toleranceNotice, roundingNotice])

        return (
            <g
                ref={this.base}
                id={makeFigmaId("marimekko-chart")}
                onMouseMove={(ev): void => this.onMouseMove(ev)}
                onMouseLeave={(): void => this.dismissTooltip()}
            >
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <DualAxisComponent
                    dualAxis={dualAxis}
                    showTickMarks={true}
                    detailsMarker={manager.detailsMarkerInSvg}
                />
                {this.showLegend && (
                    <HorizontalCategoricalColorLegend
                        state={this.legendState}
                        x={this.bounds.x}
                        y={this.bounds.top}
                        interactive={!this.isStatic}
                        styleConfig={this.legendStyleConfig}
                        binEmphasis={this.categoricalLegendEmphasis}
                        onMouseOver={this.onLegendMouseOver}
                        onMouseLeave={this.onLegendMouseLeave}
                    />
                )}
                {this.renderBars()}
                {this.renderLabelLines()}
                {this.renderLabels()}
                {target && (
                    <Tooltip
                        id="marimekkoTooltip"
                        tooltipManager={this.manager}
                        x={position.x}
                        y={position.y}
                        style={{ maxWidth: "250px" }}
                        offsetX={20}
                        offsetY={-16}
                        title={entityName}
                        subtitle={timeColumn.formatValue(endTime)}
                        footer={footer}
                        dissolve={fading}
                        dismiss={() => (this.tooltipState.target = null)}
                    >
                        {yPoint && (
                            <TooltipValue
                                label={yColumn.displayName}
                                unit={yColumn.displayUnit}
                                value={yColumn.formatValueShort(yPoint.value)}
                                originalTime={yOriginalTimeFormatted}
                                showSignificanceSuperscript={
                                    showSignificanceSuperscriptIfApplicable &&
                                    yColumn.roundsToSignificantFigures
                                }
                            />
                        )}
                        {xColumn && !xColumn.isMissing && (
                            <TooltipValue
                                label={xColumn.displayName}
                                unit={xColumn.displayUnit}
                                value={xColumn.formatValueShort(xPoint?.value)}
                                originalTime={xOriginalTimeFormatted}
                                showSignificanceSuperscript={
                                    showSignificanceSuperscriptIfApplicable &&
                                    xColumn.roundsToSignificantFigures
                                }
                            />
                        )}
                        {!colorColumn.isMissing &&
                            tooltipSeries?.entityColor &&
                            !(
                                colorColumn instanceof ColumnTypeMap.Continent
                            ) && (
                                <TooltipValue
                                    label={
                                        colorScale.legendDescription ??
                                        colorColumn.displayName
                                    }
                                    value={
                                        colorScale.getBinForValue(
                                            tooltipSeries.entityColor
                                                .colorDomainValue
                                        )?.label ??
                                        tooltipSeries.entityColor
                                            .colorDomainValue
                                    }
                                />
                            )}
                    </Tooltip>
                )}
            </g>
        )
    }

    private renderBars(): React.ReactElement {
        return (
            <MarimekkoBars
                series={this.renderSeries}
                noDataArea={this.noDataArea}
                fontSize={this.fontSize}
                onEntityClick={this.onEntityClick}
                onEntityMouseLeave={this.dismissTooltip}
                onEntityMouseOver={this.onEntityMouseOver}
            />
        )
    }

    @computed private get pickedLabelCandidates(): MarimekkoLabelCandidate[] {
        const {
            xColumnAtLastTimePoint,
            yColumnAtLastTimePoint,
            xRange,
            series,
        } = this
        const { selectedSeries, sortConfig, focusArray } = this.chartState

        if (yColumnAtLastTimePoint === undefined) return []

        const selectedEntityNames = new Set(
            selectedSeries.map((series) => series.entityName)
        )

        // This is similar to what we would get with .sortedSeries but
        // we want this for the last year to pick all labels there - sortedSeries
        // changes with the time point the user selects
        const ySizeMap: Map<string, number> = new Map(
            yColumnAtLastTimePoint.owidRows.map((row) => [
                row.entityName,
                row.value,
            ])
        )

        // We want labels to be chosen according to the latest time point available in the chart.
        // The reason for this is that it makes it so the labels are pretty consistent across time,
        // and not very jumpy when the user drags across the timeline.
        const labelCandidateSource =
            xColumnAtLastTimePoint ?? yColumnAtLastTimePoint

        // Measured before any rotation, just normal horizontal labels
        let candidates: MarimekkoLabelCandidate[] =
            labelCandidateSource.owidRows.map((row) => {
                const text =
                    getShortNameForEntity(row.entityName) ?? row.entityName
                return {
                    entityName: row.entityName,
                    text,
                    bounds: Bounds.forText(text, {
                        fontSize: this.entityLabelFontSize,
                    }),
                    xValue:
                        xColumnAtLastTimePoint !== undefined ? row.value : 1,
                    ySortValue: ySizeMap.get(row.entityName),
                    isSelected: selectedEntityNames.has(row.entityName),
                }
            })

        // If focus mode is active, only label focused series
        if (focusArray.hasFocusedSeries)
            candidates = candidates.filter((candidate) =>
                focusArray.has(candidate.entityName)
            )

        if (candidates.length === 0) return []

        candidates.sort((a, b) => {
            const yValueForA = a.ySortValue
            const yValueForB = b.ySortValue

            if (yValueForA !== undefined && yValueForB !== undefined) {
                const diff = yValueForB - yValueForA
                if (diff !== 0) return diff
                else return b.entityName.localeCompare(a.entityName)
            } else if (yValueForA === undefined && yValueForB !== undefined)
                return -1
            else if (yValueForA !== undefined && yValueForB === undefined)
                return 1
            // (yValueForA === undefined && yValueForB === undefined)
            else return 0
        })

        const isDescending = sortConfig.sortOrder === SortOrder.desc
        if (isDescending) candidates.reverse()

        const picked = new Set<EntityName>(
            candidates
                .filter((candidate) => candidate.isSelected)
                .map((candidate) => candidate.entityName)
        )

        const [withValues, withoutValues] = _.partition(
            candidates,
            (candidate) =>
                candidate.ySortValue !== 0 && candidate.ySortValue !== undefined
        )

        // Both ends of the sort always get a label
        if (withValues.length) {
            picked.add(R.first(withValues)!.entityName)
            picked.add(R.last(withValues)!.entityName)
        }
        if (withoutValues.length)
            picked.add(
                isDescending
                    ? R.first(withoutValues)!.entityName
                    : R.last(withoutValues)!.entityName
            )

        const availablePixels = xRange[1] - xRange[0]
        const labelHeight = candidates[0].bounds.height
        const numLabelsToAdd = Math.floor(
            Math.min(
                availablePixels / (labelHeight + LABEL_SPACING) / 3, // factor 3 is arbitrary to taste
                MAX_LABEL_COUNT
            )
        )

        // Spread the rest evenly by labelling the widest bar of each chunk
        const chunks = splitIntoEqualDomainSizeChunks(
            series,
            candidates,
            numLabelsToAdd
        )
        for (const chunk of chunks) {
            if (chunk.some((candidate) => picked.has(candidate.entityName)))
                continue
            const widest = _.maxBy(chunk, (candidate) => candidate.xValue)
            if (widest) picked.add(widest.entityName)
        }

        return candidates.filter((candidate) =>
            picked.has(candidate.entityName)
        )
    }

    @computed private get placedLabels(): PlacedMarimekkoLabel[] {
        const {
            dualAxis,
            placedSeriesByEntityName,
            pickedLabelCandidates,
            unrotatedLongestLabelWidth,
            unrotatedHighestLabelHeight,
        } = this
        const { x0, domainColorForEntityMap, yColumnColor } = this.chartState

        const labels: PlacedMarimekkoLabel[] = excludeUndefined(
            pickedLabelCandidates.map((candidate) => {
                const series = placedSeriesByEntityName.get(
                    candidate.entityName
                )
                if (!series) {
                    console.error("Could not find series", candidate.entityName)
                    return undefined
                }

                const centreX = series.barX + series.barWidth / 2
                const domainColor = domainColorForEntityMap.get(
                    candidate.entityName
                )
                return {
                    entityName: candidate.entityName,
                    text: candidate.text,
                    color: domainColor?.color ?? yColumnColor,
                    isSelected: candidate.isSelected,
                    preferredX: centreX,
                    correctedX: centreX,
                }
            })
        )

        // This collision detection code is optimized for the particular
        // case of distributing items in 1D, knowing that we picked a low
        // enough number of labels that we will be able to fit all labels.
        // The algorithm iterates the list twice, i.e. works in linear time
        // with the number of labels to show
        // The logic in pseudo code:
        // for current, next in iterate-left-to-right-pairs:
        //   if next.x < current.x + label-width:
        //      next.x = current.x + label-width
        // last.x = Math.min(last.x, max-x)
        // for current, prev in iterate-right-to-left-pairs:
        //   if prev.x > current.x - label-width:
        //      prev.x = current.x - label-width

        // The label width is uniform for now and starts with
        // the height of a label when printed in normal horizontal layout
        // Since labels are rotated we need to make a bit more space so that they
        // stack correctly. Consider:
        //     ╱---╱ ╱---╱
        //    ╱   ╱ ╱   ╱
        //   ╱   ╱ ╱   ╱
        //  ╱---╱ ╱---╱
        // If we would just use exactly the label width then the flatter the angle
        // the more they would actually overlap so we need a correction factor. It turns
        // out than tan(angle) is the correction factor we want, although for horizontal
        // labels we don't want to use +infinity :) so we Math.min it with the longest label width
        if (labels.length === 0) return []

        labels.sort((a, b) => {
            const diff = a.preferredX - b.preferredX
            if (diff !== 0) return diff
            else return a.entityName.localeCompare(b.entityName)
        })

        const labelWidth = unrotatedHighestLabelHeight
        const correctionFactor =
            1 +
            Math.min(
                unrotatedLongestLabelWidth / labelWidth,
                Math.abs(Math.tan(LABEL_ANGLE_IN_DEGREES))
            )
        const correctedLabelWidth = labelWidth * correctionFactor

        for (let i = 0; i < labels.length - 1; i++) {
            const current = labels[i]
            const next = labels[i + 1]
            const minNextX = current.correctedX + correctedLabelWidth
            if (next.correctedX < minNextX) next.correctedX = minNextX
        }
        const last = R.last(labels)!
        last.correctedX = Math.min(
            last.correctedX,
            dualAxis.horizontalAxis.rangeSize +
                dualAxis.horizontalAxis.place(x0)
        )
        for (let i = labels.length - 1; i > 0; i--) {
            const current = labels[i]
            const previous = labels[i - 1]
            const maxPreviousX = current.correctedX - correctedLabelWidth
            if (previous.correctedX > maxPreviousX)
                previous.correctedX = maxPreviousX
        }

        return labels
    }

    /**
     * Runs of consecutive labels that the collision pass had to shift. Each run
     * shares out the marker area's height so their connector lines don't overlap.
     */
    @computed private get shiftedLabelRuns(): PlacedMarimekkoLabel[][] {
        const runs: PlacedMarimekkoLabel[][] = []
        let startNewRun = true
        for (const label of this.placedLabels) {
            if (label.preferredX === label.correctedX) {
                startNewRun = true
            } else if (startNewRun) {
                runs.push([label])
                startNewRun = false
            } else {
                R.last(runs)!.push(label)
            }
        }
        return runs
    }

    private renderLabelLines(): React.ReactElement[] {
        const barEndpointY = this.dualAxis.verticalAxis.place(0)
        const markerBarEndpointY = barEndpointY + MARKER_MARGIN
        const markerTextEndpointY =
            barEndpointY + MARKER_AREA_HEIGHT - MARKER_MARGIN
        const markerNetHeight = MARKER_AREA_HEIGHT - 2 * MARKER_MARGIN

        const labelLines: React.ReactElement[] = []
        for (const run of this.shiftedLabelRuns) {
            const markerStepSize = markerNetHeight / (run.length + 1)
            run.forEach((label, indexInRun) => {
                const directionUnawareMakerYMid =
                    (indexInRun + 1) * markerStepSize
                const markerYMid =
                    label.preferredX > label.correctedX
                        ? directionUnawareMakerYMid
                        : markerNetHeight - directionUnawareMakerYMid
                labelLines.push(
                    <g
                        id={makeFigmaId("label-line", label.entityName)}
                        className="indicator"
                        key={`labelline-${label.entityName}`}
                    >
                        <path
                            d={`M${label.preferredX},${markerBarEndpointY} v${markerYMid} H${label.correctedX} V${markerTextEndpointY}`}
                            stroke={label.isSelected ? "#999" : "#bbb"}
                            strokeWidth={1}
                            fill="none"
                        />
                    </g>
                )
            })
        }
        const unshiftedLabels = this.placedLabels.filter(
            (label) => label.preferredX === label.correctedX
        )
        for (const label of unshiftedLabels) {
            labelLines.push(
                <g
                    id={makeFigmaId("label-line", label.entityName)}
                    key={`labelline-${label.entityName}`}
                >
                    <path
                        d={`M${label.preferredX},${markerBarEndpointY} V${markerTextEndpointY}`}
                        stroke={label.isSelected ? "#555" : "#bbb"}
                        strokeWidth={1}
                        fill="none"
                    />
                </g>
            )
        }
        return labelLines
    }

    private renderLabels(): React.ReactElement[] {
        const labelsYPosition = this.dualAxis.verticalAxis.place(0)
        return this.placedLabels.map((label) => (
            <g
                key={`label-${label.entityName}`}
                id={makeFigmaId("label", label.entityName)}
                transform={`translate(${label.correctedX}, ${MARKER_AREA_HEIGHT})`}
            >
                <g transform={`translate(0, ${labelsYPosition})`}>
                    <text
                        y={0}
                        fontWeight={label.isSelected ? 700 : 400}
                        fill={label.color}
                        transform={`rotate(${LABEL_ANGLE_IN_DEGREES}, 0, 0)`}
                        opacity={1}
                        fontSize={this.entityLabelFontSize}
                        textAnchor="end"
                        dy={dyFromAlign(VerticalAlign.middle)}
                        onMouseOver={(): void =>
                            this.onEntityMouseOver(label.entityName)
                        }
                        onMouseLeave={(): void => this.dismissTooltip()}
                        onClick={(): void =>
                            this.onEntityClick(label.entityName)
                        }
                    >
                        {label.text}
                    </text>
                </g>
            </g>
        ))
    }

    @computed private get unrotatedLongestLabelWidth(): number {
        const widths = this.pickedLabelCandidates.map(
            (candidate) => candidate.bounds.width
        )
        const maxWidth = Math.max(...widths)
        return maxWidth
    }

    @computed private get unrotatedHighestLabelHeight(): number {
        const heights = this.pickedLabelCandidates.map(
            (candidate) => candidate.bounds.height
        )
        return Math.max(...heights)
    }

    @computed private get longestLabelHeight(): number {
        // This takes the angle of rotation of the entity labels into account
        // This is somewhat simplified as we treat this as a one-dimensional
        // entity whereas in reality the textbox if of course 2D. To account
        // for that we do max(fontSize, rotatedLabelHeight) in the end
        // as a rough proxy
        const rotatedLabelHeight =
            this.unrotatedLongestLabelWidth *
            Math.abs(Math.sin((LABEL_ANGLE_IN_DEGREES * Math.PI) / 180))
        return Math.max(this.fontSize, rotatedLabelHeight)
    }

    @computed private get longestLabelWidth(): number {
        // This takes the angle of rotation of the entity labels into account
        // This is somewhat simplified as we treat this as a one-dimensional
        // entity whereas in reality the textbox if of course 2D. To account
        // for that we do max(fontSize, rotatedLabelHeight) in the end
        // as a rough proxy
        const rotatedLabelWidth =
            this.unrotatedLongestLabelWidth *
            Math.abs(Math.cos((LABEL_ANGLE_IN_DEGREES * Math.PI) / 180))
        return Math.max(this.fontSize, rotatedLabelWidth)
    }

    @computed private get entityLabelFontSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.fontSize
    }
}
