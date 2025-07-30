import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import {
    ScaleType,
    EntitySelectionMode,
    SeriesName,
    Color,
    ValueRange,
    ColumnSlug,
} from "@ourworldindata/types"
import { observable, computed, action, makeObservable } from "mobx"
import { ScaleLinear, scaleSqrt } from "d3-scale"
import { Quadtree, quadtree } from "d3-quadtree"
import { quantize, interpolate } from "d3-interpolate"
import {
    intersection,
    excludeNullish,
    pairs,
    excludeUndefined,
    domainExtent,
    getRelativeMouse,
    lowerCaseFirstLetterUnlessAbbreviation,
    exposeInstanceOnWindow,
    PointVector,
    Bounds,
    isTouchDevice,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { observer } from "mobx-react"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import {
    OwidTable,
    isNotErrorValue,
    CoreColumn,
    ColumnTypeMap,
} from "@ourworldindata/core-table"
import {
    ConnectedScatterLegend,
    ConnectedScatterLegendManager,
} from "./ConnectedScatterLegend"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "../verticalColorLegend/VerticalColorLegend"
import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"

import { ColorScale, NO_DATA_LABEL } from "../color/ColorScale"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    ScatterPlotManager,
    ScatterSeries,
    SCATTER_LABEL_DEFAULT_FONT_SIZE_FACTOR,
    SCATTER_LABEL_MAX_FONT_SIZE_FACTOR,
    SCATTER_LABEL_MIN_FONT_SIZE_FACTOR,
    SCATTER_LINE_DEFAULT_WIDTH,
    SCATTER_LINE_MAX_WIDTH,
    SCATTER_POINT_DEFAULT_RADIUS,
    SCATTER_POINT_MAX_RADIUS,
    SeriesPoint,
    ScatterPointQuadtreeNode,
    SCATTER_QUADTREE_SAMPLING_DISTANCE,
} from "./ScatterPlotChartConstants"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import { makeSelectionArray } from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import { ColorScaleBin } from "../color/ColorScaleBin"
import {
    ScatterSizeLegend,
    ScatterSizeLegendManager,
} from "./ScatterSizeLegend"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipValueRange,
    makeTooltipToleranceNotice,
    makeTooltipRoundingNotice,
} from "../tooltip/Tooltip"
import { NoDataSection } from "./NoDataSection"
import { ScatterPlotChartState } from "./ScatterPlotChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"

function computeSizeDomain(table: OwidTable, slug: ColumnSlug): ValueRange {
    const sizeValues = table.get(slug).values.filter(_.isNumber)
    return [0, _.max(sizeValues) ?? 1]
}

export type ScatterPlotChartProps = ChartComponentProps<ScatterPlotChartState>

@observer
export class ScatterPlotChart
    extends React.Component<ScatterPlotChartProps>
    implements
        ConnectedScatterLegendManager,
        ScatterSizeLegendManager,
        ChartInterface,
        VerticalColorLegendManager,
        AxisManager
{
    constructor(props: ScatterPlotChartProps) {
        super(props)

        makeObservable<ScatterPlotChart, "hoverColor">(this, {
            hoverColor: observable,
            tooltipState: observable,
        })
    }

    // currently hovered legend color
    private hoverColor: Color | undefined = undefined
    // current hovered individual series + tooltip position
    tooltipState = new TooltipState<{
        series: ScatterSeries
    }>()

    @computed get chartState(): ScatterPlotChartState {
        return this.props.chartState
    }

    @computed private get manager(): ScatterPlotManager {
        return this.chartState.manager
    }

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

    @computed private get transformedTable(): OwidTable {
        return this.chartState.transformedTable
    }

    @computed private get domainsForAnimation(): {
        x?: ValueRange
        y?: ValueRange
        size?: ValueRange
    } {
        const { inputTable } = this.chartState
        const { animationStartTime, animationEndTime } = this.manager

        if (!animationStartTime || !animationEndTime) return {}

        let table = inputTable.filterByTimeRange(
            animationStartTime,
            animationEndTime
        )

        if (this.manager.matchingEntitiesOnly && !this.colorColumn.isMissing) {
            table = table.filterByEntityNames(
                table.get(this.colorColumnSlug).uniqEntityNames
            )
        }

        table = table
            .columnFilter(
                this.xColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in X column"
            )
            .columnFilter(
                this.yColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in Y column"
            )

        const xValues = table.get(this.xColumnSlug).uniqValues
        const yValues = table.get(this.yColumnSlug).uniqValues

        return {
            x: domainExtent(xValues, this.xScaleType),
            y: domainExtent(yValues, this.yScaleType),
            size: computeSizeDomain(table, this.sizeColumn.slug),
        }
    }

    @computed.struct private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return (
            this.bounds
                .padRight(this.sidebarWidth + 20)
                // top padding leaves room for tick labels
                .padTop(this.currentVerticalAxisLabel ? 0 : 6)
                // bottom padding makes sure the x-axis label doesn't overflow
                .padBottom(2)
        )
    }

    @computed get axisBounds(): Bounds {
        return this.innerBounds
    }

    @computed get isStatic(): boolean {
        return !!this.manager.isStatic
    }

    @computed private get canAddCountry(): boolean {
        const { addCountryMode } = this.manager
        return (addCountryMode &&
            addCountryMode !== EntitySelectionMode.Disabled) as boolean
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @action.bound private onSelectEntity(entityName: SeriesName): void {
        if (this.canAddCountry) this.selectionArray.toggleSelection(entityName)
    }

    // Returns the colors that are used by all points, *across the whole timeline*.
    // This is why we need the table before the timeline filter is applied.
    @computed private get colorsInUse(): Color[] {
        const allValues =
            this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.get(
                this.colorColumnSlug
            )?.valuesIncludingErrorValues ?? []
        // Need to convert InvalidCell to undefined for color scale to assign correct color
        const colorValues = _.uniq(
            allValues.map((value: any) =>
                isNotErrorValue(value) ? value : undefined
            )
        ) as (string | number)[]
        return excludeUndefined(
            colorValues.map((colorValue) =>
                this.colorScale.getColor(colorValue)
            )
        )
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @action.bound onLegendMouseOver(color: string): void {
        if (isTouchDevice()) return
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave(): void {
        if (isTouchDevice()) return
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick(color: string): void {
        const { selectionArray } = this
        if (!this.canAddCountry) return

        const keysToToggle = this.series
            .filter((g) => g.color === color)
            .map((g) => g.seriesName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedEntityNames).length ===
            keysToToggle.length
        if (allKeysActive)
            selectionArray.setSelectedEntities(
                _.without(this.selectedEntityNames, ...keysToToggle)
            )
        else
            selectionArray.setSelectedEntities(
                _.uniq(this.selectedEntityNames.concat(keysToToggle))
            )
    }

    // Colors on the legend for which every matching series is focused
    @computed get focusColors(): string[] {
        const { colorsInUse } = this
        return colorsInUse.filter((color) => {
            const matchingKeys = this.series
                .filter((g) => g.color === color)
                .map((g) => g.seriesName)
            return (
                intersection(matchingKeys, this.selectedEntityNames).length ===
                matchingKeys.length
            )
        })
    }

    // All currently hovered series keys, combining the legend and the main UI
    @computed private get hoveredSeriesNames(): string[] {
        const { hoverColor, tooltipState } = this

        const hoveredSeriesNames =
            hoverColor === undefined
                ? []
                : _.uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )

        if (tooltipState.target) {
            hoveredSeriesNames.push(tooltipState.target.series.seriesName)
        }

        return hoveredSeriesNames
    }

    @computed private get focusedEntityNames(): string[] {
        return this.selectedEntityNames
    }

    @computed private get selectedEntityNames(): string[] {
        return this.selectionArray.selectedEntityNames
    }

    @computed get displayStartTime(): string {
        return this.transformedTable.timeColumn.formatTime(
            this.transformedTable.minTime ?? 1900
        )
    }

    @computed get displayEndTime(): string {
        return this.transformedTable.timeColumn.formatTime(
            this.transformedTable.maxTime ?? 2000
        )
    }

    @computed private get arrowLegend(): ConnectedScatterLegend | undefined {
        if (
            this.displayStartTime === this.displayEndTime ||
            this.xColumn instanceof ColumnTypeMap.Time ||
            this.yColumn instanceof ColumnTypeMap.Time ||
            this.manager.isRelativeMode
        )
            return undefined

        return new ConnectedScatterLegend(this)
    }

    @action.bound private onScatterMouseEnter(series: ScatterSeries): void {
        this.tooltipState.target = { series }
    }

    @action.bound private onScatterMouseLeave(): void {
        this.tooltipState.target = null
    }

    @action.bound private onScatterMouseMove(
        ev: React.MouseEvent<SVGGElement>
    ): void {
        const ref = this.manager?.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @action.bound private onScatterClick(): void {
        const { target } = this.tooltipState
        if (target) this.onSelectEntity(target.series.seriesName)
    }

    @computed get tooltipSeries(): ScatterSeries | undefined {
        return this.tooltipState.target?.series
    }

    @computed private get legendDimensions(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
    }

    @computed get maxLegendWidth(): number {
        return this.sidebarMaxWidth
    }

    @computed private get sidebarMinWidth(): number {
        return Math.max(this.bounds.width * 0.1, 60)
    }

    @computed private get sidebarMaxWidth(): number {
        return Math.max(this.bounds.width * 0.2, this.sidebarMinWidth)
    }

    @computed.struct get sidebarWidth(): number {
        const { legendDimensions, sidebarMinWidth, sidebarMaxWidth } = this

        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    @computed get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.axisBounds,
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
            comparisonLines: this.manager.comparisonLines,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @action.bound private onToggleEndpoints(): void {
        this.manager.compareEndPointsOnly =
            !this.compareEndPointsOnly || undefined
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors(): string[] {
        const { hoveredSeriesNames, focusedEntityNames } = this
        const activeKeys = hoveredSeriesNames.concat(focusedEntityNames)

        let series = this.series

        if (activeKeys.length)
            series = series.filter((g) => activeKeys.includes(g.seriesName))

        const colorValues = _.uniq(
            series.flatMap((s) => s.points.map((p) => p.color))
        )
        return excludeUndefined(
            colorValues.map((color) => this.colorScale.getColor(color))
        )
    }

    @computed private get hideConnectedScatterLines(): boolean {
        return !!this.manager.hideConnectedScatterLines
    }

    @computed private get hideScatterLabels(): boolean {
        return !!this.manager.hideScatterLabels
    }

    @computed private get quadtree(): Quadtree<ScatterPointQuadtreeNode> {
        const {
            series: seriesArray,
            dualAxis: { horizontalAxis, verticalAxis, innerBounds },
        } = this

        const xAxis = horizontalAxis.clone()
        xAxis.range = innerBounds.xRange()
        const yAxis = verticalAxis.clone()
        yAxis.range = innerBounds.yRange()

        const nodes: ScatterPointQuadtreeNode[] = seriesArray.flatMap(
            (series) => {
                const points = series.points.map((point) => {
                    return new PointVector(
                        xAxis.place(point.x),
                        yAxis.place(point.y)
                    )
                })

                // add single points as is
                if (points.length < 2)
                    return points.map((point) => ({
                        series,
                        x: point.x,
                        y: point.y,
                    }))

                // sample points from line segments with a fixed step size
                return pairs(points).flatMap(([a, b]) => {
                    const numPoints =
                            2 + // always include endpoints
                            Math.floor(
                                PointVector.distance(a, b) /
                                    SCATTER_QUADTREE_SAMPLING_DISTANCE
                            ),
                        lineRange = interpolate(
                            { x: a.x, y: a.y },
                            { x: b.x, y: b.y }
                        ),
                        coords = quantize(
                            (pct: number) => _.clone(lineRange(pct)),
                            numPoints
                        )

                    return coords.map((point) => ({
                        series,
                        x: point.x,
                        y: point.y,
                    }))
                })
            }
        )

        return quadtree<ScatterPointQuadtreeNode>()
            .x(({ x }) => x)
            .y(({ y }) => y)
            .addAll(nodes)
    }

    @computed private get points(): React.ReactElement {
        return (
            <ScatterPointsWithLabels
                noDataModalManager={this.manager}
                isConnected={this.chartState.isConnected}
                hideConnectedScatterLines={this.hideConnectedScatterLines}
                seriesArray={this.series}
                dualAxis={this.dualAxis}
                colorScale={
                    !this.colorColumn.isMissing ? this.colorScale : undefined
                }
                sizeScale={this.sizeScale}
                fontScale={this.fontScale}
                baseFontSize={this.fontSize}
                focusedSeriesNames={this.focusedEntityNames}
                hoveredSeriesNames={this.hoveredSeriesNames}
                tooltipSeriesName={this.tooltipSeries?.seriesName}
                disableIntroAnimation={this.manager.disableIntroAnimation}
                hideScatterLabels={this.hideScatterLabels}
                onMouseEnter={this.onScatterMouseEnter}
                onMouseLeave={this.onScatterMouseLeave}
                onClick={this.onScatterClick}
                quadtree={this.quadtree}
                backgroundColor={this.manager.backgroundColor}
            />
        )
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.chartState.colorColumnSlug
    }

    @computed private get colorColumn(): CoreColumn {
        return this.chartState.colorColumn
    }

    @computed get legendItems(): ColorScaleBin[] {
        return this.colorScale.legendBins.filter(
            (bin) =>
                this.colorsInUse.includes(bin.color) &&
                bin.label !== NO_DATA_LABEL
        )
    }

    @computed get legendTitle(): string | undefined {
        return this.colorScale.legendDescription
    }

    @computed get sizeScale(): ScaleLinear<number, number> {
        return scaleSqrt().domain(this.sizeDomain).range(this.sizeRange)
    }

    @computed private get fontScale(): ScaleLinear<number, number> {
        const defaultFontSize =
            SCATTER_LABEL_DEFAULT_FONT_SIZE_FACTOR * this.fontSize
        const minFactor = this.manager.isNarrow
            ? SCATTER_LABEL_DEFAULT_FONT_SIZE_FACTOR
            : SCATTER_LABEL_MIN_FONT_SIZE_FACTOR
        const maxFactor = this.manager.isNarrow
            ? SCATTER_LABEL_DEFAULT_FONT_SIZE_FACTOR
            : SCATTER_LABEL_MAX_FONT_SIZE_FACTOR
        const minFontSize = minFactor * this.fontSize
        const maxFontSize = maxFactor * this.fontSize
        return scaleSqrt()
            .domain(this.sizeDomain)
            .range(
                this.sizeColumn.isMissing
                    ? // if the size column is missing, we want all labels to have the same font size
                      [defaultFontSize, defaultFontSize]
                    : [minFontSize, maxFontSize]
            )
    }

    @computed private get sizeLegend(): ScatterSizeLegend | undefined {
        if (this.chartState.isConnected || this.sizeColumn.isMissing)
            return undefined
        return new ScatterSizeLegend(this)
    }

    @computed
    private get selectedEntitiesWithoutData(): string[] {
        return _.difference(
            this.selectedEntityNames,
            this.series.map((s) => s.seriesName)
        )
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    renderSidebar(): React.ReactElement {
        const {
            bounds,
            sizeLegend,
            arrowLegend,
            legendDimensions,
            sidebarWidth,
        } = this

        const hasLegendItems = this.legendItems.length > 0
        const verticalLegendHeight = hasLegendItems
            ? legendDimensions.height
            : 0
        const sizeLegendHeight = sizeLegend?.height ?? 0
        const arrowLegendHeight = arrowLegend?.height ?? 0

        const legendPadding = 16
        const ySizeLegend =
            this.legendY +
            verticalLegendHeight +
            (verticalLegendHeight > 0 ? legendPadding : 0)
        const yArrowLegend =
            ySizeLegend +
            sizeLegendHeight +
            (sizeLegendHeight > 0 ? legendPadding : 0)
        const yNoDataSection =
            yArrowLegend +
            arrowLegendHeight +
            (arrowLegendHeight > 0 ? legendPadding : 0)

        const noDataSectionBounds = new Bounds(
            this.legendX,
            yNoDataSection,
            sidebarWidth,
            bounds.height - yNoDataSection
        )

        const separatorLine = (y: number): React.ReactElement | null =>
            y > bounds.top ? (
                <line
                    id={makeIdForHumanConsumption("separator")}
                    x1={this.legendX}
                    y1={y - 0.5 * legendPadding}
                    x2={bounds.right}
                    y2={y - 0.5 * legendPadding}
                    stroke="#e7e7e7"
                />
            ) : null

        return (
            <>
                <VerticalColorLegend manager={this} />
                {sizeLegend && (
                    <>
                        {separatorLine(ySizeLegend)}
                        {sizeLegend.render(this.legendX, ySizeLegend)}
                    </>
                )}
                {arrowLegend && (
                    <>
                        {separatorLine(yArrowLegend)}
                        <g
                            className="clickable"
                            onClick={this.onToggleEndpoints}
                        >
                            {arrowLegend.render(this.legendX, yArrowLegend)}
                        </g>
                    </>
                )}
                {this.selectedEntitiesWithoutData.length > 0 && (
                    <>
                        {!this.manager.isStatic &&
                            separatorLine(noDataSectionBounds.top)}
                        <NoDataSection
                            seriesNames={this.selectedEntitiesWithoutData}
                            bounds={noDataSectionBounds}
                            baseFontSize={this.fontSize}
                        />
                    </>
                )}
            </>
        )
    }

    renderStatic(): React.ReactElement {
        return (
            <>
                <DualAxisComponent
                    dualAxis={this.dualAxis}
                    showTickMarks={false}
                    detailsMarker={this.manager.detailsMarkerInSvg}
                    backgroundColor={this.manager.backgroundColor}
                />
                {this.points}
                {this.renderSidebar()}
            </>
        )
    }

    renderInteractive(): React.ReactElement {
        return (
            <g className="ScatterPlot" onMouseMove={this.onScatterMouseMove}>
                <DualAxisComponent
                    dualAxis={this.dualAxis}
                    showTickMarks={false}
                    detailsMarker={this.manager.detailsMarkerInSvg}
                />
                {this.points}
                {this.renderSidebar()}
                {this.tooltip}
            </g>
        )
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

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }

    @computed private get tooltip(): React.ReactElement | null {
        if (!this.tooltipState.target) return null

        const {
            xColumn,
            yColumn,
            sizeColumn,
            tooltipState: { target, position, fading },
        } = this
        const points = target.series.points ?? []
        const values = excludeNullish(_.uniq([R.first(points), R.last(points)]))

        let { startTime, endTime } = this.manager
        const { x: xStart, y: yStart } = R.first(values)?.time ?? {},
            { x: xEnd, y: yEnd } = R.last(values)?.time ?? {}

        let xValues = xStart === xEnd ? [values[0].x] : values.map((v) => v.x),
            xNoticeNeeded =
                (xStart !== undefined && xStart !== startTime && xStart) ||
                (xEnd !== undefined && xEnd !== endTime && xEnd),
            xNotice = xNoticeNeeded ? [xStart, xEnd] : []

        let yValues = yStart === yEnd ? [values[0].y] : values.map((v) => v.y),
            yNoticeNeeded =
                (yStart !== undefined && yStart !== startTime && yStart) ||
                (yEnd !== undefined && yEnd !== endTime && yEnd),
            yNotice = yNoticeNeeded ? [yStart, yEnd] : []

        // handle the special case where the same variable is used for both axes
        // with a different year's value on each
        if (
            xColumn.def.datasetId === yColumn.def.datasetId &&
            points.length === 1
        ) {
            const { x, y, time } = points[0]
            if (time.x !== time.y && _.isNumber(time.x) && _.isNumber(time.y)) {
                startTime = _.min([time.x, time.y])
                endTime = _.max([time.x, time.y])
                xValues = time.x < time.y ? [x, y] : [y, x]
                xNotice = yNotice = yValues = []
                xNoticeNeeded = yNoticeNeeded = false
            }
        }

        const { isRelativeMode } = this.manager,
            timeRange = _.uniq(excludeNullish([startTime, endTime]))
                .map((t) => this.yColumn.formatTime(t))
                .join(" to "),
            targetNotice =
                xNoticeNeeded || yNoticeNeeded ? timeRange : undefined,
            timeLabel =
                timeRange + (isRelativeMode ? " (avg. annual change)" : "")

        const columns = [xColumn, yColumn, sizeColumn].filter(
            (column) => !column.isMissing
        )
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

        const toleranceNotice = targetNotice
            ? {
                  icon: TooltipFooterIcon.notice,
                  text: makeTooltipToleranceNotice(targetNotice),
              }
            : undefined
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
        const footer = excludeUndefined([toleranceNotice, roundingNotice])
        const superscript =
            !!roundingNotice && roundingNotice.icon !== TooltipFooterIcon.none

        return (
            <Tooltip
                id="scatterTooltip"
                tooltipManager={this.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "250px" }}
                title={target.series.label}
                subtitle={timeLabel}
                dissolve={fading}
                footer={footer}
                dismiss={() => (this.tooltipState.target = null)}
            >
                <TooltipValueRange
                    column={xColumn}
                    values={xValues}
                    notice={xNotice}
                    showSignificanceSuperscript={superscript}
                />
                <TooltipValueRange
                    column={yColumn}
                    values={yValues}
                    notice={yNotice}
                    showSignificanceSuperscript={superscript}
                />
                <TooltipValueRange
                    column={sizeColumn}
                    values={excludeNullish(values.map((v) => v.size))}
                    showSignificanceSuperscript={superscript}
                />
            </Tooltip>
        )
    }

    @computed get legendY(): number {
        return this.bounds.top + this.yAxis.labelHeight
    }

    @computed get legendX(): number {
        return this.bounds.right - this.sidebarWidth
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig = {} } = this.manager
        const config = {
            ...yAxisConfig,
            labelPadding: this.manager.isNarrow ? 10 : 14,
        }
        return new AxisConfig(config, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig = {} } = this.manager
        const config = {
            ...xAxisConfig,
            labelPadding: this.manager.isNarrow ? 6 : undefined,
        }
        return new AxisConfig(config, this)
    }

    @computed private get yColumnSlug(): string {
        return this.chartState.yColumnSlug
    }

    @computed private get yColumn(): CoreColumn {
        return this.chartState.yColumn
    }

    @computed private get xColumnSlug(): string {
        return this.chartState.xColumnSlug
    }

    @computed private get xColumn(): CoreColumn {
        return this.chartState.xColumn
    }

    @computed get sizeColumn(): CoreColumn {
        return this.chartState.sizeColumn
    }

    @computed private get xOverrideTime(): number | undefined {
        return this.chartState.xOverrideTime
    }

    // todo: remove. do this at table filter level
    @computed get seriesNamesToHighlight(): Set<SeriesName> {
        const seriesNames = this.selectionArray.selectedEntityNames

        if (this.manager.matchingEntitiesOnly && !this.colorColumn.isMissing)
            return new Set(
                intersection(seriesNames, this.colorColumn.uniqEntityNames)
            )

        return new Set(seriesNames)
    }

    @computed get compareEndPointsOnly(): boolean {
        return this.chartState.compareEndPointsOnly
    }

    @computed get allPoints(): SeriesPoint[] {
        return this.chartState.allPoints
    }

    // domains across the entire timeline
    private domainDefault(property: "x" | "y"): [number, number] {
        const scaleType = property === "x" ? this.xScaleType : this.yScaleType
        const defaultDomain: [number, number] =
            scaleType === ScaleType.log ? [1, 100] : [-1, 1]
        return (
            domainExtent(
                this.pointsForAxisDomains.map((point) => point[property]),
                scaleType,
                this.manager.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            ) ?? defaultDomain
        )
    }

    @computed private get validValuesForAxisDomainX(): number[] {
        const { xScaleType, pointsForAxisDomains } = this

        const values = pointsForAxisDomains.map((point) => point.x)
        return xScaleType === ScaleType.log
            ? values.filter((v) => v > 0)
            : values
    }

    @computed private get validValuesForAxisDomainY(): number[] {
        const { yScaleType, pointsForAxisDomains } = this

        const values = pointsForAxisDomains.map((point) => point.y)
        return yScaleType === ScaleType.log
            ? values.filter((v) => v > 0)
            : values
    }

    @computed private get xDomainDefault(): [number, number] {
        return this.domainDefault("x")
    }

    @computed private get selectedPoints(): SeriesPoint[] {
        const seriesNamesSet = this.seriesNamesToHighlight
        return this.allPoints.filter(
            (point) => point.entityName && seriesNamesSet.has(point.entityName)
        )
    }

    @computed private get pointsForAxisDomains(): SeriesPoint[] {
        if (
            !this.selectionArray.numSelectedEntities ||
            !this.manager.zoomToSelection
        )
            return this.allPoints

        return this.selectedPoints.length ? this.selectedPoints : this.allPoints
    }

    @computed private get sizeDomain(): [number, number] {
        if (this.sizeColumn.isMissing) return [1, 100]
        if (
            this.manager.isSingleTimeScatterAnimationActive &&
            this.domainsForAnimation.size
        ) {
            return this.domainsForAnimation.size
        }
        return computeSizeDomain(this.transformedTable, this.sizeColumn.slug)
    }

    @computed private get sizeRange(): [number, number] {
        if (this.sizeColumn.isMissing) {
            // if the size column is missing, we want all points/lines to have the same width
            return this.chartState.isConnected
                ? [SCATTER_LINE_DEFAULT_WIDTH, SCATTER_LINE_DEFAULT_WIDTH]
                : [SCATTER_POINT_DEFAULT_RADIUS, SCATTER_POINT_DEFAULT_RADIUS]
        }

        const maxLineWidth = SCATTER_LINE_MAX_WIDTH
        const maxPointRadius = Math.min(
            SCATTER_POINT_MAX_RADIUS,
            _.round(
                Math.min(this.innerBounds.width, this.innerBounds.height) *
                    0.06,
                1
            )
        )

        return this.chartState.isConnected
            ? // Note that the scale starts at 0.
              // When using the scale to plot marks, we need to make sure the minimums
              // (e.g. `SCATTER_POINT_MIN_RADIUS`) are respected.
              [0, maxLineWidth]
            : [0, maxPointRadius]
    }

    @computed private get yScaleType(): ScaleType {
        return this.chartState.yScaleType
    }

    @computed private get yDomainDefault(): [number, number] {
        return this.domainDefault("y")
    }

    @computed private get defaultYAxisLabel(): string | undefined {
        return this.yColumn?.displayName
    }

    @computed private get currentVerticalAxisLabel(): string {
        const { manager, yAxisConfig, defaultYAxisLabel } = this

        let label = yAxisConfig.label || defaultYAxisLabel || ""

        if (manager.isRelativeMode && label && label.length > 1) {
            label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                label
            )}`
        }

        return label
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const { manager, yDomainDefault, validValuesForAxisDomainY } = this
        const axisConfig = this.yAxisConfig

        const axis = axisConfig.toVerticalAxis()
        axis.formatColumn = this.yColumn
        axis.scaleType = this.yScaleType
        axis.label = this.currentVerticalAxisLabel

        if (
            this.manager.isSingleTimeScatterAnimationActive &&
            this.domainsForAnimation.y
        ) {
            axis.updateDomainPreservingUserSettings(this.domainsForAnimation.y)
        } else if (manager.isRelativeMode) {
            axis.domain = yDomainDefault // Overwrite author's min/max
        } else {
            const isAnyValueOutsideUserDomain = validValuesForAxisDomainY.some(
                (value) => value < axis.domain[0] || value > axis.domain[1]
            )

            // only overwrite the authors's min/max if there is more than one unique value along the y-axis
            // or if respecting the author's setting would hide data points
            if (
                new Set(validValuesForAxisDomainY).size > 1 ||
                isAnyValueOutsideUserDomain
            ) {
                axis.updateDomainPreservingUserSettings(yDomainDefault)
            }
        }

        return axis
    }

    @computed private get xScaleType(): ScaleType {
        return this.chartState.xScaleType
    }

    @computed private get defaultXAxisLabel(): string | undefined {
        return this.xColumn?.displayName
    }

    @computed private get xAxisLabelBase(): string {
        const xDimName = this.defaultXAxisLabel ?? ""
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed private get currentHorizontalAxisLabel(): string {
        const { manager, xAxisConfig, xAxisLabelBase } = this

        let label = xAxisConfig.label || xAxisLabelBase
        if (manager.isRelativeMode && label && label.length > 1) {
            label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                label
            )}`
        }

        return label
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const { xDomainDefault, manager } = this
        const { xAxisConfig, validValuesForAxisDomainX } = this
        const axis = xAxisConfig.toHorizontalAxis()
        axis.formatColumn = this.xColumn
        axis.scaleType = this.xScaleType

        if (this.currentHorizontalAxisLabel)
            axis.label = this.currentHorizontalAxisLabel

        if (
            this.manager.isSingleTimeScatterAnimationActive &&
            this.domainsForAnimation.x
        ) {
            axis.updateDomainPreservingUserSettings(this.domainsForAnimation.x)
        } else if (manager.isRelativeMode) {
            axis.domain = xDomainDefault // Overwrite author's min/max
        } else {
            const isAnyValueOutsideUserDomain = validValuesForAxisDomainX.some(
                (value) => value < axis.domain[0] || value > axis.domain[1]
            )

            // only overwrite the authors's min/max if there is more than one unique value along the x-axis
            // or if respecting the author's setting would hide data points
            if (
                new Set(validValuesForAxisDomainX).size > 1 ||
                isAnyValueOutsideUserDomain
            ) {
                axis.updateDomainPreservingUserSettings(xDomainDefault)
            }
        }

        return axis
    }

    @computed private get series(): ScatterSeries[] {
        return this.chartState.series
    }
}
