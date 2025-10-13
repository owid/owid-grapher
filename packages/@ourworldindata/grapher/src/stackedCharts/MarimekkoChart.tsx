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
    makeIdForHumanConsumption,
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
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    EntityName,
    VerticalAlign,
    ColorScaleConfigInterface,
} from "@ourworldindata/types"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { getShortNameForEntity } from "../chart/ChartUtils"
import { StackedSeries } from "./StackedConstants"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipValue,
    TooltipState,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
} from "../tooltip/Tooltip"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { ColorScale } from "../color/ColorScale"
import { SelectionArray } from "../selection/SelectionArray"
import {
    MarimekkoChartManager,
    Item,
    PlacedItem,
    EntityWithSize,
    LabelCandidate,
    LabelWithPlacement,
    LabelCandidateWithElement,
} from "./MarimekkoChartConstants"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { MarimekkoBars } from "./MarimekkoBars"
import { toPlacedMarimekkoItems } from "./MarimekkoChartHelpers"

const MARKER_MARGIN: number = 4
const MARKER_AREA_HEIGHT: number = 25
const MAX_LABEL_COUNT: number = 20

// if an entity name exceeds this width, we use the short name instead (if available)
const SOFT_MAX_LABEL_WIDTH = 60

export type MarimekkoChartProps = ChartComponentProps<MarimekkoChartState>

@observer
export class MarimekkoChart
    extends React.Component<MarimekkoChartProps>
    implements ChartInterface, HorizontalColorLegendManager, AxisManager
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

    @computed private get series(): readonly StackedSeries<EntityName>[] {
        return this.chartState.series
    }

    @computed private get yColumnSlugs(): string[] {
        return this.chartState.yColumnSlugs
    }

    @computed private get xColumnSlug(): string | undefined {
        return this.chartState.xColumnSlug
    }

    @computed private get xColumn(): CoreColumn | undefined {
        return this.chartState.xColumn
    }

    @computed private get latestTime(): number | undefined {
        const times =
            this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.getTimesUniqSortedAscForColumns(
                this.yColumnSlugs
            )

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

    @computed private get yColumnsAtLastTimePoint(): CoreColumn[] {
        const columnSlugs = this.yColumnSlugs
        return (
            this.tableAtLatestTimelineTimepoint?.getColumns(columnSlugs) ?? []
        )
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.chartState.yColumns
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.chartState.colorColumnSlug
    }

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

    @computed private get colorScaleConfig():
        | ColorScaleConfigInterface
        | undefined {
        return this.chartState.colorScaleConfig
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
                this.showLegend ? this.legend.height + this.legendPaddingTop : 0
            )
            .padLeft(marginToEnsureWidestEntityLabelFitsEvenIfAtX0)
    }

    @computed get isStatic(): boolean {
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

    @computed private get items(): Item[] {
        return this.chartState.items
    }

    @computed get placedItems(): PlacedItem[] {
        return toPlacedMarimekkoItems(this.chartState, {
            dualAxis: this.dualAxis,
        })
    }

    @computed private get placedItemsMap(): Map<string, PlacedItem> {
        return new Map(this.placedItems.map((item) => [item.entityName, item]))
    }

    // legend props

    @computed private get legendPaddingTop(): number {
        return this.legend.height > 0 ? this.fontSize : 0
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendOpacity(): number {
        return 0.7
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        const { colorColumnSlug, colorScale, series } = this
        if (colorColumnSlug) {
            return colorScale.categoricalLegendBins
        } else if (series.length > 0) {
            const customHiddenCategories =
                this.colorScaleConfig?.customHiddenCategories
            return series.map((series, index) => {
                return new CategoricalBin({
                    index,
                    value: series.seriesName,
                    label: series.seriesName,
                    color: series.color,
                    isHidden: !!customHiddenCategories?.[series.seriesName],
                })
            })
        }
        return []
    }

    @computed get hoverColors(): string[] {
        if (this.focusColorBin) return [this.focusColorBin.color]
        if (this.tooltipItem?.entityColor)
            return [this.tooltipItem.entityColor.color]
        if (this.selectionArray.hasSelection) {
            const selectedItems = this.items.filter((item) =>
                this.selectionArray.selectedSet.has(item.entityName)
            )
            const uniqueSelectedColors = new Set(
                selectedItems.map((item) => item.entityColor?.color)
            )
            return this.categoricalLegendData
                .filter((bin) => uniqueSelectedColors.has(bin.color as any))
                .map((bin) => bin.color)
        }
        return []
    }

    @computed private get showLegend(): boolean {
        return (
            (!!this.colorColumnSlug || this.categoricalLegendData.length > 1) &&
            !this.manager.isDisplayedAlongsideComplementaryTable
        )
    }

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.focusColorBin = bin
    }

    @action.bound onLegendMouseLeave(): void {
        this.focusColorBin = undefined
    }

    @computed private get legend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
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

    @action.bound private onEntityMouseLeave(): void {
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

    @computed private get tooltipItem(): Item | undefined {
        const { target } = this.tooltipState
        return (
            target &&
            this.items.find(
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
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        const {
            manager,
            bounds,
            dualAxis,
            tooltipItem,
            xColumn,
            yColumns,
            manager: { endTime, xOverrideTime },
            inputTable: { timeColumn },
            tooltipState: { target, position, fading },
        } = this

        const { entityName, xPoint, bars } = tooltipItem ?? {}

        const yValues =
            bars?.map((bar: any) => {
                const shouldShowYTimeNotice =
                    bar.yPoint.value !== undefined &&
                    bar.yPoint.time !== endTime

                return {
                    name: bar.seriesName,
                    value: bar.yPoint.value,
                    column: this.chartState.transformedTable.get(
                        bar.columnSlug
                    ),
                    notice: shouldShowYTimeNotice ? bar.yPoint.time : undefined,
                }
            }) ?? []

        // TODO: when we have proper time support to work across date/year variables then
        // this should be set properly and the x axis time be passed in on it's own.
        // For now we disable x axis notices when the xOverrideTime is set which is
        // usually the case when matching day and year variables
        const shouldShowXTimeNotice =
            xPoint && xPoint.time !== endTime && xOverrideTime === undefined
        const xNotice = shouldShowXTimeNotice ? xPoint?.time : undefined
        const targetNotice =
            xNotice || yValues.some(({ notice }) => !!notice)
                ? timeColumn.formatValue(endTime)
                : undefined
        const toleranceNotice = targetNotice
            ? {
                  icon: TooltipFooterIcon.notice,
                  text: makeTooltipToleranceNotice(targetNotice),
              }
            : undefined

        const columns = excludeUndefined([xColumn, ...yColumns])
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
                      ? TooltipFooterIcon.none
                      : TooltipFooterIcon.significance,
                  text: makeTooltipRoundingNotice(sigFigs, {
                      plural: sigFigs.length > 1,
                  }),
              }
            : undefined
        const superscript =
            !!roundingNotice && roundingNotice.icon !== TooltipFooterIcon.none

        const footer = excludeUndefined([toleranceNotice, roundingNotice])

        return (
            <g
                ref={this.base}
                id={makeIdForHumanConsumption("marimekko-chart")}
                className="MarimekkoChart"
                onMouseMove={(ev): void => this.onMouseMove(ev)}
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
                    backgroundColor={manager.backgroundColor}
                />
                {this.showLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
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
                        {yValues.map(({ name, value, column, notice }) => (
                            <TooltipValue
                                key={name}
                                column={column}
                                value={value}
                                notice={notice}
                                showSignificanceSuperscript={superscript}
                            />
                        ))}
                        {xColumn && (
                            <TooltipValue
                                column={xColumn}
                                value={xPoint?.value}
                                notice={xNotice}
                                showSignificanceSuperscript={superscript}
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
                dualAxis={this.dualAxis}
                focusColorBin={this.focusColorBin}
                placedItems={this.placedItems}
                tooltipState={this.tooltipState}
                fontSize={this.fontSize}
                x0={this.chartState.x0}
                y0={this.chartState.y0}
                selectionArray={this.selectionArray}
                selectedItems={this.chartState.selectedItems}
                onEntityClick={this.onEntityClick}
                onEntityMouseLeave={this.onEntityMouseLeave}
                onEntityMouseOver={this.onEntityMouseOver}
            />
        )
    }

    private paddingInPixels = 5

    private static labelCandidateFromItem(
        item: EntityWithSize,
        fontSize: number,
        isSelected: boolean
    ): LabelCandidate {
        let label = item.entityName
        let labelBounds = Bounds.forText(label, {
            fontSize,
        })
        if (labelBounds.width > SOFT_MAX_LABEL_WIDTH && item.shortEntityName) {
            label = item.shortEntityName
            labelBounds = Bounds.forText(label, {
                fontSize,
            })
        }
        return {
            item: item,
            label,
            bounds: labelBounds,
            isPicked: isSelected,
            isSelected,
        }
    }

    /** This function splits label candidates into N groups so that each group has approximately
    the same sum of x value metric. This is useful for picking labels because we want to have e.g.
    20 labels relatively evenly spaced (in x domain space) and this function gives us 20 groups that
    are roughly of equal size and then we can pick the largest of each group */
    private static splitIntoEqualDomainSizeChunks(
        items: Item[],
        candidates: LabelCandidate[],
        numChunks: number
    ): LabelCandidate[][] {
        // candidates contains all entities available in the chart for some time
        // items is just the entities for the currently selected time, so can be a way smaller subset
        const validItemNames = items.map(({ entityName }) => entityName)

        // filter the list to remove any candidates that are not currently visible
        // all further calculations are then done only with validCandidates
        const validCandidates = candidates.filter((candidate) =>
            validItemNames.includes(candidate.item.entityName)
        )

        const chunks: LabelCandidate[][] = []
        let currentChunk: LabelCandidate[] = []
        let domainSizeOfChunk = 0
        const domainSizeThreshold = Math.ceil(
            _.sumBy(validCandidates, (candidate) => candidate.item.xValue) /
                numChunks
        )
        for (const candidate of validCandidates) {
            while (domainSizeOfChunk > domainSizeThreshold) {
                chunks.push(currentChunk)
                currentChunk = []
                domainSizeOfChunk -= domainSizeThreshold
            }
            domainSizeOfChunk += candidate.item.xValue
            currentChunk.push(candidate)
        }
        chunks.push(currentChunk)

        return chunks.filter((chunk) => chunk.length > 0)
    }

    @computed private get pickedLabelCandidates(): LabelCandidate[] {
        const {
            xColumnAtLastTimePoint,
            yColumnsAtLastTimePoint,
            xRange,
            sortConfig,
            paddingInPixels,
            items,
        } = this
        const { selectedItems } = this.chartState

        if (yColumnsAtLastTimePoint.length === 0) return []

        // Measure the labels (before any rotation, just normal horizontal labels)
        const selectedItemsSet = new Set(
            selectedItems.map((item) => item.entityName)
        )

        // This is similar to what we would get with .sortedItems but
        // we want this for the last year to pick all labels there - sortedItems
        // changes with the time point the user selects
        const ySizeMap: Map<string, number> = new Map(
            yColumnsAtLastTimePoint[0].owidRows.map((row) => [
                row.entityName,
                row.value,
            ])
        )

        // We want labels to be chosen according to the latest time point available in the chart.
        // The reason for this is that it makes it so the labels are pretty consistent across time,
        // and not very jumpy when the user drags across the timeline.
        const labelCandidateSource = xColumnAtLastTimePoint
            ? xColumnAtLastTimePoint
            : yColumnsAtLastTimePoint[0]

        let labelCandidates: LabelCandidate[] =
            labelCandidateSource.owidRows.map((row) =>
                MarimekkoChart.labelCandidateFromItem(
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
                    selectedItemsSet.has(row.entityName)
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
        const chunks = MarimekkoChart.splitIntoEqualDomainSizeChunks(
            items,
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
            placedItemsMap,
            labels,
            unrotatedLongestLabelWidth,
            unrotatedHighestLabelHeight,
            labelAngleInDegrees,
        } = this
        const { x0 } = this.chartState
        const labelsYPosition = dualAxis.verticalAxis.place(0)

        const labelsWithPlacements: LabelWithPlacement[] = labels
            .map(({ candidate, labelElement }) => {
                const item = placedItemsMap.get(candidate.item.entityName)
                if (!item)
                    console.error("Could not find item in placedItemsMap")
                const xPoint = item?.xPoint?.value ?? 1
                const barWidth =
                    dualAxis.horizontalAxis.place(xPoint) -
                    dualAxis.horizontalAxis.place(x0)

                const labelId = candidate.item.entityName
                if (!item) {
                    console.error(
                        "Could not find item",
                        candidate.item.entityName
                    )
                    return null
                } else {
                    const currentX =
                        dualAxis.horizontalAxis.place(x0) + item.xPosition
                    const labelWithPlacement = {
                        label: (
                            <g
                                transform={`translate(${0}, ${labelsYPosition})`}
                            >
                                {labelElement}
                            </g>
                        ),
                        preferredPlacement: currentX + barWidth / 2,
                        correctedPlacement: currentX + barWidth / 2,
                        labelKey: labelId,
                    }
                    return labelWithPlacement
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
        const { selectedItems } = this.chartState
        const shiftedGroups: LabelWithPlacement[][] = []
        const unshiftedElements: LabelWithPlacement[] = []
        const selectedItemsKeys = new Set(
            selectedItems.map((item) => item.entityName)
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
                const lineColor = selectedItemsKeys.has(item.labelKey)
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
                        id={makeIdForHumanConsumption(
                            "label-line",
                            item.labelKey
                        )}
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
            const lineColor = selectedItemsKeys.has(item.labelKey)
                ? "#555"
                : "#bbb"
            const markerBarEndpointX = item.preferredPlacement
            const markerBarEndpointY = barEndpointY + MARKER_MARGIN
            const markerTextEndpointY =
                barEndpointY + MARKER_AREA_HEIGHT - MARKER_MARGIN

            labelLines.push(
                <g
                    id={makeIdForHumanConsumption("label-line", item.labelKey)}
                    className="indicator"
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
                id={makeIdForHumanConsumption("label", item.labelKey)}
                className="bar-label"
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
        const { labelAngleInDegrees, series } = this
        const { domainColorForEntityMap } = this.chartState
        return this.pickedLabelCandidates.map((candidate) => {
            const labelX = candidate.bounds.width
            const domainColor = this.chartState.isFocusModeActive
                ? undefined
                : domainColorForEntityMap.get(candidate.item.entityName)
            const seriesColor = series[0].color
            const color = domainColor?.color ?? seriesColor ?? "#000"
            return {
                candidate,
                labelElement: (
                    <text
                        key={`${candidate.item.entityName}-label`}
                        x={-labelX}
                        y={0}
                        width={candidate.bounds.width}
                        height={candidate.bounds.height}
                        fontWeight={candidate.isSelected ? 700 : 400}
                        fill={color}
                        transform={`rotate(${labelAngleInDegrees}, 0, 0)`}
                        opacity={1}
                        fontSize={this.entityLabelFontSize}
                        textAnchor="right"
                        dy={dyFromAlign(VerticalAlign.middle)}
                        onMouseOver={(): void =>
                            this.onEntityMouseOver(candidate.item.entityName)
                        }
                        onMouseLeave={(): void => this.onEntityMouseLeave()}
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
