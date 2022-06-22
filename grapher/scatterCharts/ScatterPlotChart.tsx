import React from "react"
import { ComparisonLineConfig } from "../scatterCharts/ComparisonLine.js"
import { observable, computed, action } from "mobx"
import { ScaleLinear, scaleSqrt } from "d3-scale"
import {
    intersection,
    without,
    uniq,
    last,
    excludeUndefined,
    flatten,
    isEmpty,
    isNumber,
    domainExtent,
    lowerCaseFirstLetterUnlessAbbreviation,
    relativeMinAndMax,
    exposeInstanceOnWindow,
    groupBy,
    sampleFrom,
    intersectionOfSets,
    max,
} from "../../clientUtils/Util.js"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import {
    BASE_FONT_SIZE,
    ScaleType,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
    SeriesName,
} from "../core/GrapherConstants.js"
import { Color } from "../../coreTable/CoreTableConstants.js"
import {
    ConnectedScatterLegend,
    ConnectedScatterLegendManager,
} from "./ConnectedScatterLegend.js"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "../verticalColorLegend/VerticalColorLegend.js"
import { DualAxisComponent } from "../axis/AxisViews.js"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis.js"
import { ComparisonLine } from "./ComparisonLine.js"

import { ColorScale, ColorScaleManager } from "../color/ColorScale.js"
import { AxisConfig } from "../axis/AxisConfig.js"
import { ChartInterface } from "../chart/ChartInterface.js"
import {
    ScatterPlotManager,
    ScatterSeries,
    SCATTER_LABEL_DEFAULT_FONT_SIZE,
    SCATTER_LABEL_MAX_FONT_SIZE,
    SCATTER_LABEL_MIN_FONT_SIZE,
    SCATTER_LINE_DEFAULT_WIDTH,
    SCATTER_LINE_MAX_WIDTH,
    SCATTER_POINT_DEFAULT_RADIUS,
    SCATTER_POINT_MAX_RADIUS,
    SeriesPoint,
} from "./ScatterPlotChartConstants.js"
import { ScatterTooltip } from "./ScatterTooltip.js"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels.js"
import {
    EntityName,
    OwidRow,
    OwidTableSlugs,
} from "../../coreTable/OwidTableConstants.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import {
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import {
    defaultIfErrorValue,
    isNotErrorValue,
} from "../../coreTable/ErrorValues.js"
import {
    ColorScaleConfig,
    ColorScaleConfigDefaults,
} from "../color/ColorScaleConfig.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { ColorScaleBin } from "../color/ColorScaleBin.js"
import {
    ScatterSizeLegend,
    ScatterSizeLegendManager,
} from "./ScatterSizeLegend.js"

@observer
export class ScatterPlotChart
    extends React.Component<{
        bounds?: Bounds
        manager: ScatterPlotManager
    }>
    implements
        ConnectedScatterLegendManager,
        ScatterSizeLegendManager,
        ChartInterface,
        VerticalColorLegendManager,
        ColorScaleManager
{
    // currently hovered individual series key
    @observable private hoveredSeries?: SeriesName
    // currently hovered legend color
    @observable private hoverColor?: Color

    transformTable(table: OwidTable): OwidTable {
        const { backgroundSeriesLimit, excludedEntities, addCountryMode } =
            this.manager

        if (
            addCountryMode === EntitySelectionMode.Disabled ||
            addCountryMode === EntitySelectionMode.SingleEntity
        ) {
            table = table.filterByEntityNames(
                this.selectionArray.selectedEntityNames
            )
        }

        if (excludedEntities) {
            const excludedEntityIdsSet = new Set(excludedEntities)
            table = table.columnFilter(
                OwidTableSlugs.entityId,
                (entityId) => !excludedEntityIdsSet.has(entityId as number),
                `Excluded entity ids specified by author: ${excludedEntities.join(
                    ", "
                )}`
            )
        }

        // Allow authors to limit the # of background entities to get better perf and clearer charts.
        if (backgroundSeriesLimit) {
            const selectedSeriesNames = new Set<SeriesName>(
                this.selectionArray.selectedEntityNames
            )
            // Todo: implement a better strategy for picking the entities to show for context. Maybe a couple per decile?
            const backgroundSeriesNames = new Set<SeriesName>(
                sampleFrom(
                    table.availableEntityNames.filter(
                        (name) => !selectedSeriesNames.has(name)
                    ),
                    backgroundSeriesLimit,
                    123
                )
            )
            table = table.columnFilter(
                table.entityNameSlug,
                (name) =>
                    selectedSeriesNames.has(name as string) ||
                    backgroundSeriesNames.has(name as string),
                `Capped background series at ${backgroundSeriesLimit}`
            )
        }

        if (this.xScaleType === ScaleType.log && this.xColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.xColumnSlug])

        if (this.yScaleType === ScaleType.log && this.yColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.yColumnSlug])

        if (this.sizeColumnSlug) {
            const tolerance =
                table.get(this.sizeColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.sizeColumnSlug,
                tolerance
            )
        }

        if (this.colorColumnSlug) {
            const tolerance =
                table.get(this.colorColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.colorColumnSlug,
                tolerance
            )
            if (this.manager.matchingEntitiesOnly) {
                table = table.dropRowsWithErrorValuesForColumn(
                    this.colorColumnSlug
                )
            }
        }

        // We want to "chop off" any rows outside the time domain for X and Y to avoid creating
        // leading and trailing timeline times that don't really exist in the dataset.
        const [timeDomainStart, timeDomainEnd] = table.timeDomainFor([
            this.xColumnSlug,
            this.yColumnSlug,
        ])
        table = table.filterByTimeRange(
            timeDomainStart ?? -Infinity,
            timeDomainEnd ?? Infinity
        )

        if (this.xOverrideTime !== undefined) {
            table = table.interpolateColumnWithTolerance(this.yColumnSlug)
        } else {
            table = table.interpolateColumnsByClosestTimeMatch(
                this.xColumnSlug,
                this.yColumnSlug
            )
        }

        // Drop any rows which have non-number values for X or Y.
        // This needs to be done after the tolerance, because the tolerance may fill in some gaps.
        table = table
            .columnFilter(
                this.xColumnSlug,
                isNumber,
                "Drop rows with non-number values in X column"
            )
            .columnFilter(
                this.yColumnSlug,
                isNumber,
                "Drop rows with non-number values in Y column"
            )

        // The tolerance application might lead to some data being dropped for some years.
        // For example, if X times are [2000, 2005, 2010], and Y times are [2005], then for all 3
        // rows we have the same match [[2005, 2005], [2005, 2005], [2005, 2005]].
        // This means we can drop 2000 and 2010 from the timeline.
        // It might not make a huge difference here, but it makes a difference when there are more
        // entities covering different time periods.
        const [originalTimeDomainStart, originalTimeDomainEnd] =
            table.originalTimeDomainFor([this.xColumnSlug, this.yColumnSlug])
        table = table.filterByTimeRange(
            originalTimeDomainStart ?? -Infinity,
            originalTimeDomainEnd ?? Infinity
        )

        return table
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed private get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    // TODO chunk this up into multiple computeds for better performance?
    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        if (
            this.manager.hideLinesOutsideTolerance &&
            this.manager.startTime !== undefined &&
            this.manager.endTime !== undefined
        ) {
            const entityNames = Array.from(
                intersectionOfSets(
                    [this.manager.startTime, this.manager.endTime].map(
                        (targetTime) =>
                            table.filterByTargetTimes([targetTime], 0)
                                .availableEntityNameSet
                    )
                )
            )
            table = table.filterByEntityNames(entityNames)
        }
        // We don't want to apply this transform when relative mode is also enabled, it has a
        // sligthly different endpoints logic that drops initial zeroes to avoid DivideByZero error.
        if (this.compareEndPointsOnly && !this.manager.isRelativeMode) {
            table = table.keepMinTimeAndMaxTimeForEachEntityOnly()
        }
        if (this.manager.isRelativeMode) {
            table = table.toAverageAnnualChangeForEachEntity([
                this.xColumnSlug,
                this.yColumnSlug,
            ])
        }
        return table
    }

    @computed private get manager(): ScatterPlotManager {
        return this.props.manager
    }

    @computed.struct private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get canAddCountry(): boolean {
        const { addCountryMode } = this.manager
        return (addCountryMode &&
            addCountryMode !== EntitySelectionMode.Disabled) as boolean
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
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
        const colorValues = uniq(
            allValues.map((value) =>
                isNotErrorValue(value) ? value : undefined
            )
        ) as (string | number)[]
        return excludeUndefined(
            colorValues.map((colorValue) =>
                this.colorScale.getColor(colorValue)
            )
        )
    }

    @computed get fontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @action.bound onLegendMouseOver(color: string): void {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick(): void {
        const { hoverColor, selectionArray } = this
        if (!this.canAddCountry || hoverColor === undefined) return

        const keysToToggle = this.series
            .filter((g) => g.color === hoverColor)
            .map((g) => g.seriesName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedEntityNames).length ===
            keysToToggle.length
        if (allKeysActive)
            selectionArray.setSelectedEntities(
                without(this.selectedEntityNames, ...keysToToggle)
            )
        else
            selectionArray.setSelectedEntities(
                uniq(this.selectedEntityNames.concat(keysToToggle))
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
        const { hoverColor, hoveredSeries } = this

        const hoveredSeriesNames =
            hoverColor === undefined
                ? []
                : uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )

        if (hoveredSeries !== undefined) hoveredSeriesNames.push(hoveredSeries)

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
            this.manager.isRelativeMode
        )
            return undefined

        return new ConnectedScatterLegend(this)
    }

    @action.bound private onScatterMouseOver(series: ScatterSeries): void {
        this.hoveredSeries = series.seriesName
    }

    @action.bound private onScatterMouseLeave(): void {
        this.hoveredSeries = undefined
    }

    @action.bound private onScatterClick(): void {
        if (this.hoveredSeries) this.onSelectEntity(this.hoveredSeries)
    }

    @computed get tooltipSeries(): ScatterSeries | undefined {
        const { hoveredSeries, focusedEntityNames } = this
        if (hoveredSeries !== undefined)
            return this.series.find((g) => g.seriesName === hoveredSeries)
        if (focusedEntityNames && focusedEntityNames.length === 1)
            return this.series.find(
                (g) => g.seriesName === focusedEntityNames[0]
            )
        return undefined
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

    // todo: Refactor
    @computed get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.bounds.padRight(this.sidebarWidth + 20),
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed private get comparisonLines():
        | ComparisonLineConfig[]
        | undefined {
        return this.manager.comparisonLines
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

        const colorValues = uniq(
            flatten(series.map((s) => s.points.map((p) => p.color)))
        )
        return excludeUndefined(
            colorValues.map((color) => this.colorScale.getColor(color))
        )
    }

    @computed private get hideConnectedScatterLines(): boolean {
        return !!this.manager.hideConnectedScatterLines
    }

    @computed private get points(): JSX.Element {
        return (
            <ScatterPointsWithLabels
                noDataModalManager={this.manager}
                isConnected={this.isConnected}
                hideConnectedScatterLines={this.hideConnectedScatterLines}
                seriesArray={this.series}
                dualAxis={this.dualAxis}
                colorScale={
                    !this.colorColumn.isMissing ? this.colorScale : undefined
                }
                sizeScale={this.sizeScale}
                fontScale={this.fontScale}
                focusedSeriesNames={this.focusedEntityNames}
                hoveredSeriesNames={this.hoveredSeriesNames}
                disableIntroAnimation={this.manager.disableIntroAnimation}
                onMouseOver={this.onScatterMouseOver}
                onMouseLeave={this.onScatterMouseLeave}
                onClick={this.onScatterClick}
            />
        )
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get legendItems(): ColorScaleBin[] {
        return this.colorScale.legendBins.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get legendTitle(): string | undefined {
        return this.colorScale.legendDescription
    }

    @computed get sizeScale(): ScaleLinear<number, number> {
        return scaleSqrt()
            .domain(this.sizeDomain)
            .range(
                this.sizeColumn.isMissing
                    ? // if the size column is missing, we want all points/lines to have the same width
                      this.isConnected
                        ? [
                              SCATTER_LINE_DEFAULT_WIDTH,
                              SCATTER_LINE_DEFAULT_WIDTH,
                          ]
                        : [
                              SCATTER_POINT_DEFAULT_RADIUS,
                              SCATTER_POINT_DEFAULT_RADIUS,
                          ]
                    : this.isConnected
                    ? // Note that the scale starts at 0.
                      // When using the scale to plot marks, we need to make sure the minimums
                      // (e.g. `SCATTER_POINT_MIN_RADIUS`) are respected.
                      [0, SCATTER_LINE_MAX_WIDTH]
                    : [0, SCATTER_POINT_MAX_RADIUS]
            )
    }

    @computed get fontScale(): ScaleLinear<number, number> {
        return scaleSqrt()
            .domain(this.sizeDomain)
            .range(
                this.sizeColumn.isMissing
                    ? // if the size column is missing, we want all labels to have the same font size
                      [
                          SCATTER_LABEL_DEFAULT_FONT_SIZE,
                          SCATTER_LABEL_DEFAULT_FONT_SIZE,
                      ]
                    : [SCATTER_LABEL_MIN_FONT_SIZE, SCATTER_LABEL_MAX_FONT_SIZE]
            )
    }

    /** Whether series are shown as lines (instead of single points) */
    @computed private get isConnected(): boolean {
        return this.series.some((s) => s.points.length > 1)
    }

    @computed private get sizeLegend(): ScatterSizeLegend | undefined {
        if (this.isConnected || this.sizeColumn.isMissing) return undefined
        return new ScatterSizeLegend(this)
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            bounds,
            dualAxis,
            arrowLegend,
            sizeLegend,
            sidebarWidth,
            tooltipSeries,
            comparisonLines,
            legendDimensions,
        } = this

        const sizeLegendY = bounds.top + legendDimensions.height + 8
        const arrowLegendY = sizeLegend
            ? sizeLegendY + sizeLegend.height + 15
            : sizeLegendY
        const tooltipY = arrowLegend
            ? arrowLegendY + arrowLegend.height + 10
            : arrowLegendY

        return (
            <g className="ScatterPlot">
                <DualAxisComponent dualAxis={dualAxis} showTickMarks={false} />
                {comparisonLines &&
                    comparisonLines.map((line, i) => (
                        <ComparisonLine
                            key={i}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                {this.points}
                <VerticalColorLegend manager={this} />
                {this.sizeLegend?.render(this.legendX, sizeLegendY)}
                {(arrowLegend || tooltipSeries) && (
                    <line
                        x1={bounds.right - sidebarWidth}
                        y1={arrowLegendY - 7}
                        x2={bounds.right - 5}
                        y2={arrowLegendY - 7}
                        stroke="#ccc"
                    />
                )}
                {arrowLegend && (
                    <g className="clickable" onClick={this.onToggleEndpoints}>
                        {arrowLegend.render(
                            bounds.right - sidebarWidth,
                            arrowLegendY
                        )}
                    </g>
                )}
                {tooltipSeries && (
                    <ScatterTooltip
                        yColumn={this.yColumn!}
                        xColumn={this.xColumn!}
                        series={tooltipSeries}
                        maxWidth={sidebarWidth}
                        fontSize={this.fontSize}
                        x={bounds.right - sidebarWidth}
                        y={tooltipY}
                    />
                )}
            </g>
        )
    }

    @computed get legendY(): number {
        return this.bounds.top
    }

    @computed get legendX(): number {
        return this.bounds.right - this.sidebarWidth
    }

    colorScale = this.props.manager.colorScaleOverride ?? new ColorScale(this)

    @computed get colorScaleColumn(): CoreColumn {
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            this.manager.colorScaleColumnOverride ??
            // We need to use inputTable in order to get consistent coloring for a variable across
            // charts, e.g. each continent being assigned to the same color.
            // inputTable is unfiltered, so it contains every value that exists in the variable.
            this.inputTable.get(this.colorColumnSlug)
        )
    }

    @computed get colorScaleConfig(): ColorScaleConfigDefaults | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = "#959595"

    @computed get hasNoDataBin(): boolean {
        if (this.colorColumn.isMissing) return false
        return this.colorColumn.valuesIncludingErrorValues.some(
            (value) => !isNotErrorValue(value)
        )
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.xAxisConfig, this)
    }

    @computed private get yColumnSlug(): string {
        return autoDetectYColumnSlugs(this.manager)[0]
    }

    @computed private get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed private get xColumnSlug(): string {
        const { xColumnSlug } = this.manager
        return xColumnSlug ?? this.manager.table.timeColumn.slug
    }

    @computed private get xColumn(): CoreColumn {
        return this.transformedTable.get(this.xColumnSlug)
    }

    @computed private get sizeColumnSlug(): string | undefined {
        return this.manager.sizeColumnSlug
    }

    @computed get sizeColumn(): CoreColumn {
        return this.transformedTable.get(this.sizeColumnSlug)
    }

    @computed get failMessage(): string {
        if (this.yColumn.isMissing) return "Missing Y axis variable"

        if (this.yColumn.isMissing) return "Missing X axis variable"

        if (isEmpty(this.allEntityNamesWithXAndY)) {
            if (
                this.manager.isRelativeMode &&
                this.manager.hasTimeline &&
                this.manager.startTime === this.manager.endTime
            ) {
                return "Please select a start and end point on the timeline below"
            }
            return "No entities with data for both X and Y"
        }

        if (isEmpty(this.series)) return "No matching data"

        return ""
    }

    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime(): number | undefined {
        return this.manager.xOverrideTime
    }

    // Unlike other charts, the scatterplot shows all available data by default, and the selection
    // is just for emphasis. But this behavior can be disabled.
    @computed private get hideBackgroundEntities(): boolean {
        return this.manager.addCountryMode === EntitySelectionMode.Disabled
    }

    @computed private get allEntityNamesWithXAndY(): EntityName[] {
        return intersection(
            this.yColumn.uniqEntityNames,
            this.xColumn.uniqEntityNames
        )
    }

    // todo: remove. do this at table filter level
    getSeriesNamesToShow(
        filterBackgroundEntities = this.hideBackgroundEntities
    ): Set<SeriesName> {
        const seriesNames = filterBackgroundEntities
            ? this.selectionArray.selectedEntityNames
            : this.allEntityNamesWithXAndY

        if (this.manager.matchingEntitiesOnly && !this.colorColumn.isMissing)
            return new Set(
                intersection(seriesNames, this.colorColumn.uniqEntityNames)
            )

        return new Set(seriesNames)
    }

    @computed get compareEndPointsOnly(): boolean {
        return !!this.manager.compareEndPointsOnly
    }

    @computed get allPoints(): SeriesPoint[] {
        return flatten(this.series.map((series) => series.points))
    }

    // domains across the entire timeline
    private domainDefault(property: "x" | "y"): [number, number] {
        const scaleType = property === "x" ? this.xScaleType : this.yScaleType
        if (!this.manager.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map((point) => point[property]),
                scaleType,
                this.manager.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            )
        }

        if (this.manager.isRelativeMode)
            return relativeMinAndMax(this.allPoints, property)

        return domainExtent(
            this.allPoints.map((v) => v[property]),
            scaleType
        )
    }

    @computed private get xDomainDefault(): [number, number] {
        return this.domainDefault("x")
    }

    @computed private get selectedPoints(): SeriesPoint[] {
        const seriesNamesSet = this.getSeriesNamesToShow(true)
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
        const sizeValues = this.transformedTable
            .get(this.sizeColumn.slug)
            .values.filter(isNumber)
        return [0, max(sizeValues) ?? 1]
    }

    @computed private get yScaleType(): ScaleType {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : this.yAxisConfig.scaleType || ScaleType.linear
    }

    @computed private get yDomainDefault(): [number, number] {
        return this.domainDefault("y")
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const { manager, yDomainDefault } = this
        const axisConfig = this.yAxisConfig

        const axis = axisConfig.toVerticalAxis()
        axis.formatColumn = this.yColumn
        const label = axisConfig.label || this.yColumn?.displayName || ""
        axis.scaleType = this.yScaleType

        if (manager.isRelativeMode) {
            axis.domain = yDomainDefault // Overwrite user's min/max
            if (label && label.length > 1) {
                axis.label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                    label
                )}`
            }
        } else {
            axis.updateDomainPreservingUserSettings(yDomainDefault)
            axis.label = label
        }

        return axis
    }

    @computed private get xScaleType(): ScaleType {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : this.xAxisConfig.scaleType ?? ScaleType.linear
    }

    @computed private get xAxisLabelBase(): string {
        const xDimName = this.xColumn?.displayName
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const { xDomainDefault, manager, xAxisLabelBase } = this
        const { xAxisConfig } = this
        const axis = xAxisConfig.toHorizontalAxis()
        axis.formatColumn = this.xColumn
        axis.scaleType = this.xScaleType
        if (manager.isRelativeMode) {
            axis.domain = xDomainDefault // Overwrite user's min/max
            const label = xAxisConfig.label || xAxisLabelBase
            if (label && label.length > 1) {
                axis.label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                    label
                )}`
            }
        } else {
            axis.updateDomainPreservingUserSettings(xDomainDefault)
            const label = xAxisConfig.label || xAxisLabelBase
            if (label) axis.label = label
        }
        return axis
    }

    getPointLabel(row: OwidRow): string | undefined {
        const strat = this.manager.scatterPointLabelStrategy
        let label
        if (strat === ScatterPointLabelStrategy.y) {
            label = this.yColumn?.formatValue(row[this.yColumnSlug])
        } else if (strat === ScatterPointLabelStrategy.x) {
            label = this.xColumn?.formatValue(row[this.xColumnSlug])
        } else {
            label = this.transformedTable.timeColumn.formatTime(
                row[this.transformedTable.timeColumn.slug]
            )
        }
        return label
    }

    private removePointsOutsidePlane(points: SeriesPoint[]): SeriesPoint[] {
        const { yAxisConfig, xAxisConfig } = this
        if (
            yAxisConfig.removePointsOutsideDomain ||
            xAxisConfig.removePointsOutsideDomain
        ) {
            return points.filter((point) => {
                return (
                    !xAxisConfig.shouldRemovePoint(point.x) &&
                    !yAxisConfig.shouldRemovePoint(point.y)
                )
            })
        }
        return points
    }

    @computed private get allPointsBeforeEndpointsFilter(): SeriesPoint[] {
        const { entityNameSlug, timeColumn } = this.transformedTable
        // We are running this filter first because it only depends on author-specified config, not
        // on any user interaction.
        return this.removePointsOutsidePlane(
            this.transformedTable.rows.map((row) => {
                return {
                    x: row[this.xColumnSlug],
                    y: row[this.yColumnSlug],
                    size: defaultIfErrorValue(
                        row[this.sizeColumn.slug],
                        undefined
                    ),
                    color: defaultIfErrorValue(
                        row[this.colorColumn.slug],
                        undefined
                    ),
                    entityName: row[entityNameSlug],
                    label: this.getPointLabel(row) ?? "",
                    timeValue: row[timeColumn.slug],
                    time: {
                        x: row[this.xColumn!.originalTimeColumnSlug!],
                        y: row[this.yColumn!.originalTimeColumnSlug!],
                    },
                }
            })
        )
    }

    @computed get series(): ScatterSeries[] {
        return Object.entries(
            groupBy(this.allPointsBeforeEndpointsFilter, (p) => p.entityName)
        ).map(([entityName, points]) => {
            const series: ScatterSeries = {
                seriesName: entityName,
                label: entityName,
                color: "#932834", // Default color, used when no color dimension is present
                points,
            }
            this.assignColorToSeries(entityName, series)
            return series
        })
    }

    private assignColorToSeries(
        entityName: EntityName,
        series: ScatterSeries
    ): void {
        if (series.points.length) {
            const keyColor =
                this.transformedTable.getColorForEntityName(entityName)
            if (keyColor !== undefined) series.color = keyColor
            else if (!this.colorColumn.isMissing) {
                const colorValue = last(
                    series.points.map((point) => point.color)
                )
                const color = this.colorScale.getColor(colorValue)
                if (color !== undefined) {
                    series.color = color
                    series.isScaleColor = true
                }
            }
        }
    }
}
