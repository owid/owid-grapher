import * as _ from "lodash-es"
import React from "react"
import { EntitySelectionMode, SeriesName, Color } from "@ourworldindata/types"
import { observable, computed, action, makeObservable } from "mobx"
import { ScaleLinear, scaleSqrt } from "d3-scale"
import { Quadtree, quadtree } from "d3-quadtree"
import { pairs } from "d3-array"
import { quantize, interpolate } from "d3-interpolate"
import {
    intersection,
    excludeUndefined,
    getRelativeMouse,
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
import { getShortNameForEntity } from "../chart/ChartUtils"
import {
    ScatterPlotManager,
    ScatterSeries,
    SCATTER_LABEL_DEFAULT_FONT_SIZE_FACTOR,
    SCATTER_LABEL_MAX_FONT_SIZE_FACTOR,
    SCATTER_LABEL_MIN_FONT_SIZE_FACTOR,
    SeriesPoint,
    ScatterPointQuadtreeNode,
    SCATTER_QUADTREE_SAMPLING_DISTANCE,
} from "./ScatterPlotChartConstants"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import { ColorScaleBin } from "../color/ColorScaleBin"
import {
    ScatterSizeLegend,
    ScatterSizeLegendManager,
} from "./ScatterSizeLegend"
import { TooltipState } from "../tooltip/Tooltip"
import { NoDataSection } from "./NoDataSection"
import { ScatterPlotChartState } from "./ScatterPlotChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { toSizeRange } from "./ScatterUtils.js"
import { ScatterPlotTooltip } from "./ScatterPlotTooltip"

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

    @computed.struct private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return (
            this.bounds
                .padRight(this.sidebarWidth > 0 ? this.sidebarWidth + 20 : 0)
                // top padding leaves room for tick labels
                .padTop(this.chartState.verticalAxisLabel ? 0 : 6)
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

    @action.bound private onSelectEntity(entityName: SeriesName): void {
        if (this.canAddCountry)
            this.chartState.selectionArray.toggleSelection(entityName)
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

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        if (isTouchDevice()) return
        this.hoverColor = bin.color
    }

    @action.bound onLegendMouseLeave(): void {
        if (isTouchDevice()) return
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick(bin: ColorScaleBin): void {
        const { selectionArray } = this.chartState
        if (!this.canAddCountry) return

        const color = bin.color

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
        return this.chartState.selectionArray.selectedEntityNames
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
            this.xColumn.isTimeColumn ||
            this.yColumn.isTimeColumn ||
            this.manager.isRelativeMode ||
            this.manager.isDisplayedAlongsideComplementaryTable
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

    @computed private get verticalColorLegend():
        | VerticalColorLegend
        | undefined {
        if (
            this.categoricalLegendData.length === 0 ||
            this.manager.isDisplayedAlongsideComplementaryTable
        )
            return undefined
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
        const { sidebarMinWidth, sidebarMaxWidth } = this

        if (
            !this.verticalColorLegend &&
            !this.sizeLegend &&
            !this.arrowLegend &&
            !this.hasNoDataSection
        )
            return 0

        return Math.max(
            Math.min(this.verticalColorLegend?.width ?? 0, sidebarMaxWidth),
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

    @computed get categoricalLegendData(): ColorScaleBin[] {
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
        return scaleSqrt()
            .domain(this.chartState.sizeDomain)
            .range(this.sizeRange)
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
            .domain(this.chartState.sizeDomain)
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
        const entitiesWithoutData = _.uniq(
            _.difference(
                this.selectedEntityNames,
                this.series.map((s) => s.seriesName)
            )
        )

        return entitiesWithoutData.map((entityName) => {
            const shortName = getShortNameForEntity(entityName)
            return shortName ?? entityName
        })
    }

    @computed private get hasNoDataSection(): boolean {
        return this.selectedEntitiesWithoutData.length > 0
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    renderSidebar(): React.ReactElement | null {
        const {
            bounds,
            sizeLegend,
            arrowLegend,
            verticalColorLegend,
            sidebarWidth,
        } = this

        const verticalLegendHeight = verticalColorLegend?.height ?? 0
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
                {verticalColorLegend && <VerticalColorLegend manager={this} />}
                {sizeLegend && (
                    <>
                        {verticalColorLegend && separatorLine(ySizeLegend)}
                        {sizeLegend.render(this.legendX, ySizeLegend)}
                    </>
                )}
                {arrowLegend && (
                    <>
                        {(verticalColorLegend || sizeLegend) &&
                            separatorLine(yArrowLegend)}
                        <g
                            className="clickable"
                            onClick={this.onToggleEndpoints}
                        >
                            {arrowLegend.render(this.legendX, yArrowLegend)}
                        </g>
                    </>
                )}
                {this.hasNoDataSection && (
                    <>
                        {!this.manager.isStatic &&
                            (verticalColorLegend ||
                                sizeLegend ||
                                arrowLegend) &&
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
        return (
            <ScatterPlotTooltip
                chartState={this.chartState}
                tooltipState={this.tooltipState}
            />
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

    @computed private get yColumn(): CoreColumn {
        return this.chartState.yColumn
    }

    @computed private get xColumn(): CoreColumn {
        return this.chartState.xColumn
    }

    @computed get sizeColumn(): CoreColumn {
        return this.chartState.sizeColumn
    }

    @computed get compareEndPointsOnly(): boolean {
        return this.chartState.compareEndPointsOnly
    }

    @computed get allPoints(): SeriesPoint[] {
        return this.chartState.allPoints
    }

    @computed private get sizeRange(): [number, number] {
        return toSizeRange(this.chartState, this.innerBounds)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get series(): ScatterSeries[] {
        return this.chartState.series
    }
}
