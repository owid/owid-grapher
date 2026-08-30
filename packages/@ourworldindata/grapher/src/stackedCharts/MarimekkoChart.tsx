import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import {
    Bounds,
    excludeUndefined,
    HorizontalAlign,
    Position,
    SortConfig,
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
import { ColorScale } from "../color/ColorScale"
import { SelectionArray } from "../selection/SelectionArray"
import {
    MarimekkoChartManager,
    MarimekkoNoDataArea,
    MarimekkoSeries,
    PlacedMarimekkoSeries,
    RenderMarimekkoSeries,
    LabelCandidate,
    LabelWithPlacement,
    LabelCandidateWithElement,
} from "./MarimekkoChartConstants"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { MarimekkoBars } from "./MarimekkoBars"
import {
    splitIntoEqualDomainSizeChunks,
    toLabelCandidate,
    toMarimekkoNoDataArea,
    toPlacedMarimekkoSeries,
    toRenderMarimekkoSeries,
} from "./MarimekkoChartHelpers"

const MARKER_MARGIN: number = 4
const MARKER_AREA_HEIGHT: number = 25
const MAX_LABEL_COUNT: number = 20

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

    labelAngleInDegrees = -45 // 0 is horizontal, -90 is vertical from bottom to top, ...

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

    @computed private get inputTable(): OwidTable {
        return this.chartState.inputTable
    }

    @computed private get series(): readonly MarimekkoSeries[] {
        return this.chartState.series
    }

    @computed private get yColumnSlug(): string | undefined {
        return this.chartState.yColumnSlug
    }

    @computed private get xColumnSlug(): string | undefined {
        return this.chartState.xColumnSlug
    }

    @computed private get xColumn(): CoreColumn | undefined {
        return this.chartState.xColumn
    }

    @computed private get colorColumn(): CoreColumn | undefined {
        return this.chartState.colorColumn
    }

    @computed private get latestTime(): number | undefined {
        const times = this.yColumnSlug
            ? this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.getTimesUniqSortedAscForColumns(
                  [this.yColumnSlug]
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
        if (this.xColumnSlug === undefined) return undefined
        const columnSlug = [this.xColumnSlug]
        if (this.tableAtLatestTimelineTimepoint)
            return this.tableAtLatestTimelineTimepoint.getColumns(columnSlug)[0]
        else return undefined
    }

    @computed private get yColumnAtLastTimePoint(): CoreColumn | undefined {
        if (this.yColumnSlug === undefined) return undefined
        return this.tableAtLatestTimelineTimepoint?.getColumns([
            this.yColumnSlug,
        ])[0]
    }

    @computed private get yColumn(): CoreColumn {
        return this.chartState.yColumn
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.chartState.colorColumnSlug
    }

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

    @computed private get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
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
        const { xColumnSlug } = this
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

    @computed private get selectionArray(): SelectionArray {
        return this.chartState.selectionArray
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
            selectedEntityNames: this.selectionArray.selectedSet,
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
        if (!this.colorColumnSlug) return []
        return this.colorScale.categoricalLegendBins
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
        if (this.selectionArray.hasSelection) {
            const selectedSeries = this.series.filter((series) =>
                this.selectionArray.selectedSet.has(series.entityName)
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
        return !!this.colorColumnSlug && !!this.manager.showLegend
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
        if (this.canAddCountry) this.selectionArray.toggleSelection(entityName)
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
            xColumn,
            yColumn,
            colorColumn,
            colorScale,
            manager: { endTime, xOverrideTime },
            inputTable: { timeColumn },
            tooltipState: { target, position, fading },
        } = this

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
                {this.labelLines}
                {this.placedLabels}
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
                        {colorColumn &&
                            !colorColumn.isMissing &&
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

    private readonly paddingInPixels = 5

    @computed private get pickedLabelCandidates(): LabelCandidate[] {
        const {
            xColumnAtLastTimePoint,
            yColumnAtLastTimePoint,
            xRange,
            sortConfig,
            paddingInPixels,
            series,
        } = this
        const { selectedSeries } = this.chartState

        if (yColumnAtLastTimePoint === undefined) return []

        // Measure the labels (before any rotation, just normal horizontal labels)
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

        let labelCandidates: LabelCandidate[] =
            labelCandidateSource.owidRows.map((row) =>
                toLabelCandidate(
                    {
                        entityName: row.entityName,
                        shortEntityName: getShortNameForEntity(row.entityName),
                        xValue:
                            xColumnAtLastTimePoint !== undefined
                                ? row.value
                                : 1,
                        ySortValue: ySizeMap.get(row.entityName),
                    },
                    this.entityLabelFontSize,
                    selectedEntityNames.has(row.entityName)
                )
            )

        // If focus mode is active, only label focused series
        if (this.chartState.focusArray.hasFocusedSeries) {
            labelCandidates = labelCandidates.filter((candidate) =>
                this.chartState.focusArray.has(candidate.item.entityName)
            )
        }

        if (labelCandidates.length === 0) return []

        labelCandidates.sort((a, b) => {
            const yRowsForA = a.item.ySortValue
            const yRowsForB = b.item.ySortValue

            if (yRowsForA !== undefined && yRowsForB !== undefined) {
                const diff = yRowsForB - yRowsForA
                if (diff !== 0) return diff
                else return b.item.entityName.localeCompare(a.item.entityName)
            } else if (yRowsForA === undefined && yRowsForB !== undefined)
                return -1
            else if (yRowsForA !== undefined && yRowsForB === undefined)
                return 1
            // (yRowsForA === undefined && yRowsForB === undefined)
            else return 0
        })

        if (sortConfig.sortOrder === SortOrder.desc) {
            labelCandidates.reverse()
        }

        const [sortedLabelsWithValues, sortedLabelsWithoutValues] = _.partition(
            labelCandidates,
            (item) =>
                item.item.ySortValue !== 0 && item.item.ySortValue !== undefined
        )

        if (sortedLabelsWithValues.length) {
            R.first(sortedLabelsWithValues)!.isPicked = true
            R.last(sortedLabelsWithValues)!.isPicked = true
        }
        if (sortedLabelsWithoutValues.length) {
            if (sortConfig.sortOrder === SortOrder.desc)
                R.first(sortedLabelsWithoutValues)!.isPicked = true
            else R.last(sortedLabelsWithoutValues)!.isPicked = true
        }
        const availablePixels = xRange[1] - xRange[0]

        const labelHeight = labelCandidates[0].bounds.height

        const numLabelsToAdd = Math.floor(
            Math.min(
                availablePixels / (labelHeight + paddingInPixels) / 3, // factor 3 is arbitrary to taste
                MAX_LABEL_COUNT
            )
        )
        const chunks = splitIntoEqualDomainSizeChunks(
            series,
            labelCandidates,
            numLabelsToAdd
        )
        const picks = chunks.flatMap((chunk) => {
            const picked = chunk.filter((candidate) => candidate.isPicked)
            if (picked.length > 0) return picked
            else {
                return _.maxBy(chunk, (candidate) => candidate.item.xValue)
            }
        })
        for (const max of picks) {
            if (max) max.isPicked = true
        }
        const picked = labelCandidates.filter((candidate) => candidate.isPicked)

        return picked
    }

    @computed private get labelsWithPlacementInfo(): LabelWithPlacement[] {
        const {
            dualAxis,
            placedSeriesByEntityName,
            labels,
            unrotatedLongestLabelWidth,
            unrotatedHighestLabelHeight,
            labelAngleInDegrees,
        } = this
        const { x0 } = this.chartState
        const labelsYPosition = dualAxis.verticalAxis.place(0)

        const labelsWithPlacements: LabelWithPlacement[] = labels
            .map(({ candidate, labelElement }) => {
                const series = placedSeriesByEntityName.get(
                    candidate.item.entityName
                )
                if (!series) {
                    console.error(
                        "Could not find series",
                        candidate.item.entityName
                    )
                    return null
                }

                const centreX = series.barX + series.barWidth / 2
                return {
                    label: (
                        <g transform={`translate(${0}, ${labelsYPosition})`}>
                            {labelElement}
                        </g>
                    ),
                    preferredPlacement: centreX,
                    correctedPlacement: centreX,
                    labelKey: candidate.item.entityName,
                }
            })
            .filter(
                (item: LabelWithPlacement | null): item is LabelWithPlacement =>
                    item !== null
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
        if (labelsWithPlacements.length === 0) return []

        labelsWithPlacements.sort((a, b) => {
            const diff = a.preferredPlacement - b.preferredPlacement
            if (diff !== 0) return diff
            else return a.labelKey.localeCompare(b.labelKey)
        })

        const labelWidth = unrotatedHighestLabelHeight
        const correctionFactor =
            1 +
            Math.min(
                unrotatedLongestLabelWidth / labelWidth,
                Math.abs(Math.tan(labelAngleInDegrees))
            )
        const correctedLabelWidth = labelWidth * correctionFactor

        for (let i = 0; i < labelsWithPlacements.length - 1; i++) {
            const current = labelsWithPlacements[i]
            const next = labelsWithPlacements[i + 1]
            const minNextX = current.correctedPlacement + correctedLabelWidth
            if (next.correctedPlacement < minNextX)
                next.correctedPlacement = minNextX
        }
        labelsWithPlacements[
            labelsWithPlacements.length - 1
        ].correctedPlacement = Math.min(
            labelsWithPlacements[labelsWithPlacements.length - 1]
                .correctedPlacement,
            dualAxis.horizontalAxis.rangeSize +
                dualAxis.horizontalAxis.place(x0)
        )
        for (let i = labelsWithPlacements.length - 1; i > 0; i--) {
            const current = labelsWithPlacements[i]
            const previous = labelsWithPlacements[i - 1]
            const maxPreviousX =
                current.correctedPlacement - correctedLabelWidth
            if (previous.correctedPlacement > maxPreviousX)
                previous.correctedPlacement = maxPreviousX
        }

        return labelsWithPlacements
    }

    @computed private get labelLines(): React.ReactElement[] {
        const { labelsWithPlacementInfo, dualAxis } = this
        const { selectedSeries } = this.chartState
        const shiftedGroups: LabelWithPlacement[][] = []
        const unshiftedElements: LabelWithPlacement[] = []
        const selectedEntityNames = new Set(
            selectedSeries.map((series) => series.entityName)
        )
        let startNewGroup = true

        const barEndpointY = dualAxis.verticalAxis.place(0)

        for (const labelWithPlacement of labelsWithPlacementInfo) {
            if (
                labelWithPlacement.preferredPlacement ===
                labelWithPlacement.correctedPlacement
            ) {
                unshiftedElements.push(labelWithPlacement)
                startNewGroup = true
            } else {
                if (startNewGroup) {
                    shiftedGroups.push([labelWithPlacement])
                    startNewGroup = false
                } else {
                    shiftedGroups[shiftedGroups.length - 1].push(
                        labelWithPlacement
                    )
                }
            }
        }
        // If we wanted to hide the label lines if all lines are straight
        // then we could do this but this makes it jumpy over time
        // if (shiftedGroups.length === 0) return []
        // else {
        const labelLines: React.ReactElement[] = []
        for (const group of shiftedGroups) {
            let indexInGroup = 0
            for (const item of group) {
                const lineColor = selectedEntityNames.has(item.labelKey)
                    ? "#999"
                    : "#bbb"
                const markerBarEndpointX = item.preferredPlacement
                const markerTextEndpointX = item.correctedPlacement
                const markerBarEndpointY = barEndpointY + MARKER_MARGIN
                const markerTextEndpointY =
                    barEndpointY + MARKER_AREA_HEIGHT - MARKER_MARGIN
                const markerNetHeight = MARKER_AREA_HEIGHT - 2 * MARKER_MARGIN
                const markerStepSize = markerNetHeight / (group.length + 1)
                const directionUnawareMakerYMid =
                    (indexInGroup + 1) * markerStepSize
                const markerYMid =
                    markerBarEndpointX > markerTextEndpointX
                        ? directionUnawareMakerYMid
                        : markerNetHeight - directionUnawareMakerYMid
                labelLines.push(
                    <g
                        id={makeFigmaId("label-line", item.labelKey)}
                        className="indicator"
                        key={`labelline-${item.labelKey}`}
                    >
                        <path
                            d={`M${markerBarEndpointX},${markerBarEndpointY} v${markerYMid} H${markerTextEndpointX} V${markerTextEndpointY}`}
                            stroke={lineColor}
                            strokeWidth={1}
                            fill="none"
                        />
                    </g>
                )
                indexInGroup++
            }
        }
        for (const item of unshiftedElements) {
            const lineColor = selectedEntityNames.has(item.labelKey)
                ? "#555"
                : "#bbb"
            const markerBarEndpointX = item.preferredPlacement
            const markerBarEndpointY = barEndpointY + MARKER_MARGIN
            const markerTextEndpointY =
                barEndpointY + MARKER_AREA_HEIGHT - MARKER_MARGIN

            labelLines.push(
                <g
                    id={makeFigmaId("label-line", item.labelKey)}
                    key={`labelline-${item.labelKey}`}
                >
                    <path
                        d={`M${markerBarEndpointX},${markerBarEndpointY} V${markerTextEndpointY}`}
                        stroke={lineColor}
                        strokeWidth={1}
                        fill="none"
                    />
                </g>
            )
        }
        return labelLines
        //}
    }

    @computed private get placedLabels(): React.ReactElement[] {
        const labelOffset = MARKER_AREA_HEIGHT
        // old logic tried to hide labellines but that is too jumpy
        // labelLines.length
        //     ? MARKER_AREA_HEIGHT
        //     : this.baseFontSize / 2
        const placedLabels = this.labelsWithPlacementInfo.map((item) => (
            <g
                key={`label-${item.labelKey}`}
                id={makeFigmaId("label", item.labelKey)}
                transform={`translate(${item.correctedPlacement}, ${labelOffset})`}
            >
                {item.label}
            </g>
        ))

        return placedLabels
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
            Math.abs(Math.sin((this.labelAngleInDegrees * Math.PI) / 180))
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
            Math.abs(Math.cos((this.labelAngleInDegrees * Math.PI) / 180))
        return Math.max(this.fontSize, rotatedLabelWidth)
    }

    @computed private get entityLabelFontSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get labels(): LabelCandidateWithElement[] {
        const { labelAngleInDegrees } = this
        const { domainColorForEntityMap, yColumnColor } = this.chartState
        return this.pickedLabelCandidates.map((candidate) => {
            const domainColor = domainColorForEntityMap.get(
                candidate.item.entityName
            )
            const color = domainColor?.color ?? yColumnColor ?? "#000"
            return {
                candidate,
                labelElement: (
                    <text
                        key={`${candidate.item.entityName}-label`}
                        y={0}
                        fontWeight={candidate.isSelected ? 700 : 400}
                        fill={color}
                        transform={`rotate(${labelAngleInDegrees}, 0, 0)`}
                        opacity={1}
                        fontSize={this.entityLabelFontSize}
                        textAnchor="end"
                        dy={dyFromAlign(VerticalAlign.middle)}
                        onMouseOver={(): void =>
                            this.onEntityMouseOver(candidate.item.entityName)
                        }
                        onMouseLeave={(): void => this.dismissTooltip()}
                        onClick={(): void =>
                            this.onEntityClick(candidate.item.entityName)
                        }
                    >
                        {candidate.label}
                    </text>
                ),
            }
        })
    }
}
