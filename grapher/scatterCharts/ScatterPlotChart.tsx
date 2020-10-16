import * as React from "react"
import { observable, computed, action } from "mobx"
import {
    intersection,
    without,
    uniq,
    last,
    excludeUndefined,
    flatten,
    isEmpty,
    isNumber,
    has,
    sortedFindClosestIndex,
    domainExtent,
    lowerCaseFirstLetterUnlessAbbreviation,
    relativeMinAndMax,
    identity,
    exposeInstanceOnWindow,
} from "grapher/utils/Util"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { NoDataModal } from "grapher/noDataModal/NoDataModal"
import {
    BASE_FONT_SIZE,
    ScaleType,
    DimensionProperty,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
    SeriesName,
} from "grapher/core/GrapherConstants"
import { Color, Time } from "coreTable/CoreTableConstants"
import {
    ConnectedScatterLegend,
    ConnectedScatterLegendManager,
} from "./ConnectedScatterLegend"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import { ComparisonLine } from "./ComparisonLine"

import { CoreColumn } from "coreTable/CoreTableColumns"
import { ColorScale, ColorScaleManager } from "grapher/color/ColorScale"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    ScatterPlotManager,
    ScatterSeries,
    SeriesPoint,
    SeriesPointMap,
} from "./ScatterPlotChartConstants"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"
import { ScatterTooltip } from "./ScatterTooltip"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import { EntityName, OwidRow } from "coreTable/OwidTableConstants"
import { OwidTable } from "coreTable/OwidTable"

@observer
export class ScatterPlotChart
    extends React.Component<{
        bounds?: Bounds
        manager: ScatterPlotManager
    }>
    implements
        ConnectedScatterLegendManager,
        ChartInterface,
        VerticalColorLegendManager,
        ColorScaleManager {
    // currently hovered individual series key
    @observable private hoveredSeries?: SeriesName
    // currently hovered legend color
    @observable private hoverColor?: Color

    transformTable(table: OwidTable) {
        if (this.xScaleType === ScaleType.log && this.xColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.xColumnSlug])

        if (this.yScaleType === ScaleType.log && this.yColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.yColumnSlug])

        return table
    }

    @computed get inputTable() {
        return this.manager.table
    }

    @computed get transformedTable() {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed.struct private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get canAddCountry() {
        const { addCountryMode } = this.manager
        return addCountryMode && addCountryMode !== EntitySelectionMode.Disabled
    }

    @action.bound private onSelectEntity(entityName: SeriesName) {
        if (this.canAddCountry)
            this.transformedTable.toggleSelection(entityName)
    }

    // Only want to show colors on legend that are actually on the chart right now
    @computed private get colorsInUse() {
        return excludeUndefined(
            uniq(
                this.allPoints.map((point) =>
                    this.colorScale.getColor(point.color)
                )
            )
        )
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { hoverColor, transformedTable } = this
        if (!this.canAddCountry || hoverColor === undefined) return

        const keysToToggle = this.series
            .filter((g) => g.color === hoverColor)
            .map((g) => g.seriesName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedEntityNames).length ===
            keysToToggle.length
        if (allKeysActive)
            transformedTable.setSelectedEntities(
                without(this.selectedEntityNames, ...keysToToggle)
            )
        else
            transformedTable.setSelectedEntities(
                uniq(this.selectedEntityNames.concat(keysToToggle))
            )
    }

    // Colors on the legend for which every matching series is focused
    @computed get focusColors() {
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
    @computed private get hoveredSeriesNames() {
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

    @computed private get focusedEntityNames() {
        return this.selectedEntityNames
    }

    @computed private get selectedEntityNames() {
        return this.transformedTable.selectedEntityNames
    }

    @computed get displayStartTime() {
        return this.transformedTable.timeColumnFormatFunction(
            this.transformedTable.minTime ?? 1900
        )
    }

    @computed get displayEndTime() {
        return this.transformedTable.timeColumnFormatFunction(
            this.transformedTable.maxTime ?? 2000
        )
    }

    @computed private get arrowLegend() {
        if (
            this.displayStartTime === this.displayEndTime ||
            this.manager.isRelativeMode
        )
            return undefined

        return new ConnectedScatterLegend(this)
    }

    @action.bound private onScatterMouseOver(series: ScatterSeries) {
        this.hoveredSeries = series.seriesName
    }

    @action.bound private onScatterMouseLeave() {
        this.hoveredSeries = undefined
    }

    @action.bound private onScatterClick() {
        if (this.hoveredSeries) this.onSelectEntity(this.hoveredSeries)
    }

    @computed private get tooltipSeries() {
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

    @computed get maxLegendWidth() {
        return this.sidebarMaxWidth
    }

    @computed private get sidebarMinWidth() {
        return Math.max(this.bounds.width * 0.1, 60)
    }

    @computed private get sidebarMaxWidth() {
        return Math.max(this.bounds.width * 0.2, this.sidebarMinWidth)
    }

    @computed.struct private get sidebarWidth() {
        const { legendDimensions, sidebarMinWidth, sidebarMaxWidth } = this

        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    // todo: Refactor
    @computed get dualAxis() {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.bounds.padRight(this.sidebarWidth + 20),
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed private get comparisonLines() {
        return this.manager.comparisonLines
    }

    @action.bound private onToggleEndpoints() {
        this.compareEndPointsOnly = !this.compareEndPointsOnly
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors() {
        const { hoveredSeriesNames, focusedEntityNames } = this
        const activeKeys = hoveredSeriesNames.concat(focusedEntityNames)

        let series = this.series

        if (activeKeys.length)
            series = series.filter((g) => activeKeys.includes(g.seriesName))

        const colorValues = uniq(
            flatten(series.map((s) => s.points.map((p) => p.color)))
        )
        return excludeUndefined(colorValues.map(this.colorScale.getColor))
    }

    @computed private get hideLines() {
        return !!this.manager.hideConnectedScatterLines
    }

    @computed private get points() {
        const {
            dualAxis,
            focusedEntityNames,
            hoveredSeriesNames,
            hideLines,
            manager,
            series,
            sizeDomain,
            colorScale,
        } = this

        return (
            <ScatterPointsWithLabels
                noDataModalManager={manager}
                hideLines={hideLines}
                seriesArray={series}
                dualAxis={dualAxis}
                colorScale={this.colorColumn ? colorScale : undefined}
                sizeDomain={sizeDomain}
                focusedSeriesNames={focusedEntityNames}
                hoveredSeriesNames={hoveredSeriesNames}
                onMouseOver={this.onScatterMouseOver}
                onMouseLeave={this.onScatterMouseLeave}
                onClick={this.onScatterClick}
            />
        )
    }

    @computed private get colorColumn() {
        return this.transformedTable.get(this.manager.colorColumnSlug)
    }

    @computed get colorBins() {
        return this.colorScale.legendBins.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get title() {
        return this.colorScale.legendDescription
    }

    componentDidMount() {
        exposeInstanceOnWindow(this)
    }

    render() {
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
            sidebarWidth,
            tooltipSeries,
            comparisonLines,
            manager,
            legendDimensions,
        } = this

        return (
            <g className="ScatterPlot">
                <DualAxisComponent
                    isInteractive={!manager.isStaticSvg}
                    dualAxis={dualAxis}
                    showTickMarks={false}
                />
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
                {(arrowLegend || tooltipSeries) && (
                    <line
                        x1={bounds.right - sidebarWidth}
                        y1={bounds.top + legendDimensions.height + 2}
                        x2={bounds.right - 5}
                        y2={bounds.top + legendDimensions.height + 2}
                        stroke="#ccc"
                    />
                )}
                {arrowLegend && (
                    <g className="clickable" onClick={this.onToggleEndpoints}>
                        {arrowLegend.render(
                            bounds.right - sidebarWidth,
                            bounds.top + legendDimensions.height + 11
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
                        y={
                            bounds.top +
                            legendDimensions.height +
                            11 +
                            (arrowLegend ? arrowLegend.height + 10 : 0)
                        }
                    />
                )}
            </g>
        )
    }

    @computed get legendY() {
        return this.bounds.top
    }

    @computed get legendX() {
        return this.bounds.right - this.sidebarWidth
    }

    @computed get colorScale() {
        return new ColorScale(this)
    }

    @computed get colorScaleConfig() {
        return this.manager.colorScale! || new ColorScaleConfig()
    }

    defaultBaseColorScheme = "continents"
    defaultNoDataColor = "#959595"

    @computed get hasNoDataBin() {
        const colorColumn = this.colorColumn
        return !!(
            colorColumn &&
            this.allPoints.some((point) => point.color === undefined)
        )
    }

    @computed get categoricalValues() {
        const colorColumn = this.colorColumn
        return colorColumn?.sortedUniqNonEmptyStringVals ?? []
    }

    @computed private get yAxisConfig() {
        return (
            this.manager.yAxis ?? new AxisConfig(this.manager.yAxisConfig, this)
        )
    }

    @computed private get xAxisConfig() {
        return (
            this.manager.xAxis ?? new AxisConfig(this.manager.xAxisConfig, this)
        )
    }

    @computed private get yColumnSlug() {
        const { yColumnSlug, yColumnSlugs, table } = this.manager
        const ySlugs = yColumnSlugs ?? []
        return yColumnSlug ?? ySlugs[0] ?? table.numericColumnSlugs[0]
    }

    @computed private get yColumn() {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed private get xColumnSlug() {
        const { xColumnSlug, table } = this.manager
        return xColumnSlug ?? table.numericColumnSlugs[1]
    }

    @computed private get xColumn() {
        return this.transformedTable.get(this.xColumnSlug)
    }

    @computed private get sizeColumn() {
        return this.transformedTable.get(this.manager.sizeColumnSlug)
    }

    @computed get failMessage() {
        if (!this.yColumn) return "Missing Y axis variable"

        if (!this.xColumn) return "Missing X axis variable"

        if (isEmpty(this.allEntityNamesWithXAndY))
            return "No entities with data for both X and Y"

        if (isEmpty(this.possibleTimes))
            return "No times with data for both X and Y"

        if (isEmpty(this.series)) return "No matching data"

        return ""
    }

    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime() {
        return undefined // this.xColumn && this.xColumn.targetTime
    }

    set xOverrideTime(value: number | undefined) {
        // this.xDimension!.targetTime = value
    }

    // Unlike other charts, the scatterplot shows all available data by default, and the selection
    // is just for emphasis. But this behavior can be disabled.
    @computed private get hideBackgroundEntities() {
        return this.manager.addCountryMode === EntitySelectionMode.Disabled
    }

    @computed private get allEntityNamesWithXAndY(): EntityName[] {
        if (!this.yColumn || !this.xColumn) return []
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
            ? this.transformedTable.selectedEntityNames
            : this.allEntityNamesWithXAndY

        if (this.manager.matchingEntitiesOnly && this.colorColumn)
            return new Set(
                intersection(seriesNames, this.colorColumn.uniqEntityNames)
            )

        return new Set(seriesNames)
    }

    // The times for which there MAY be data on the scatterplot
    // Not all of these will necessarily end up on the timeline, because there may be no x/y entity overlap for that time
    // e.g. https://ourworldindata.org/grapher/life-expectancy-years-vs-real-gdp-per-capita-2011us
    @computed private get possibleTimes(): Time[] {
        if (!this.yColumn) return []

        if (this.xOverrideTime !== undefined) return this.yColumn.uniqTimesAsc

        if (!this.xColumn) return []

        return intersection(
            this.yColumn.uniqTimesAsc,
            this.xColumn.uniqTimesAsc
        )
    }

    @computed private get compareEndPointsOnly() {
        return !!this.manager.compareEndPointsOnly
    }

    private set compareEndPointsOnly(value: boolean) {
        this.manager.compareEndPointsOnly = value ?? undefined
    }

    @computed private get columns() {
        return [
            this.yColumn,
            this.xColumn,
            this.colorColumn,
            this.sizeColumn,
        ].filter(identity) as CoreColumn[]
    }

    // todo: move this sort of thing to OwidTable
    // todo: add unit tests for this thing
    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    private getPointsByEntityAndTime(
        seriesNamesToShow = this.getSeriesNamesToShow()
    ): SeriesPointMap {
        const pointsByEntityAndTime: SeriesPointMap = new Map()

        for (const column of this.columns) {
            const rowsByEntity = new Map<EntityName, OwidRow[]>()
            column.owidRows
                .filter((row) => {
                    if (!seriesNamesToShow.has(row.entityName)) return false
                    if (
                        (column === this.xColumn || column === this.yColumn) &&
                        !isNumber(row.value)
                    )
                        return false
                    return true
                })
                .forEach((row) => {
                    let rows = rowsByEntity.get(row.entityName)
                    if (!rows) {
                        rows = []
                        rowsByEntity.set(row.entityName, rows)
                    }

                    rows.push(row as any)
                })
            this.setPointsUsingTolerance(
                column,
                pointsByEntityAndTime,
                rowsByEntity
            )
        }

        this.removePointsMissingCoordinatesOrOutsidePlane(pointsByEntityAndTime)
        return pointsByEntityAndTime
    }

    private setPointsUsingTolerance(
        column: CoreColumn,
        pointsByEntityAndTime: SeriesPointMap,
        rowsByEntity: Map<EntityName, OwidRow[]>
    ) {
        const { possibleTimes, xOverrideTime } = this
        const tolerance =
            column === this.sizeColumn ? Infinity : column.tolerance

        // Now go through each entity + timeline year and use a binary search to find the closest
        // matching data year within tolerance
        // NOTE: this code assumes years is sorted asc!!!
        rowsByEntity.forEach((rows, entityName) => {
            let pointsByTime = pointsByEntityAndTime.get(entityName)
            if (pointsByTime === undefined) {
                pointsByTime = new Map<Time, SeriesPoint>()
                pointsByEntityAndTime.set(entityName, pointsByTime)
            }

            const property = this.propertyForColumn(column)
            const times = rows.map((row) => row.time)

            for (const outputTime of possibleTimes) {
                const targetTime =
                    xOverrideTime !== undefined && column === this.xColumn
                        ? xOverrideTime
                        : outputTime
                const index = sortedFindClosestIndex(times, targetTime)
                const { time, value } = rows[index]

                // Skip years that aren't within tolerance of the target
                if (
                    time < targetTime - tolerance ||
                    time > targetTime + tolerance
                ) {
                    continue
                }

                let point = pointsByTime.get(outputTime)
                if (point === undefined) {
                    point = {
                        entityName,
                        timeValue: outputTime,
                        time: {},
                    } as SeriesPoint
                    pointsByTime.set(outputTime, point)
                }

                point[property] = value
                if (
                    property === DimensionProperty.x ||
                    property === DimensionProperty.y
                )
                    point.time[property] = time
            }
        })
    }

    propertyForColumn(column: CoreColumn) {
        if (this.xColumn === column) return DimensionProperty.x
        if (this.yColumn === column) return DimensionProperty.y
        if (this.sizeColumn === column) return DimensionProperty.size
        return DimensionProperty.color
    }

    private removePointsMissingCoordinatesOrOutsidePlane(
        pointsByEntityAndTime: SeriesPointMap
    ) {
        // The exclusion of points happens as a last step in order to avoid artefacts due to
        // the tolerance calculation. E.g. if we pre-filter the data based on the X and Y
        // domains before creating the points, the tolerance may lead to different X-Y
        // values being joined.
        // -@danielgavrilov, 2020-04-29
        const { yAxisConfig, xAxisConfig } = this
        pointsByEntityAndTime.forEach((series) => {
            series.forEach((point, time) => {
                // Exclude any points with data for only one axis
                if (!has(point, "x") || !has(point, "y")) series.delete(time)
                // Exclude points that go beyond min/max of X axis
                else if (xAxisConfig.shouldRemovePoint(point.x))
                    series.delete(time)
                // Exclude points that go beyond min/max of Y axis
                else if (yAxisConfig.shouldRemovePoint(point.y))
                    series.delete(time)
            })
        })
    }

    @computed get allPoints() {
        const allPoints: SeriesPoint[] = []
        this.getPointsByEntityAndTime().forEach((series) => {
            series.forEach((point) => {
                allPoints.push(point)
            })
        })
        return allPoints
    }

    @computed private get currentValues() {
        return flatten(this.series.map((g) => g.points))
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

    @computed private get xDomainDefault() {
        return this.domainDefault("x")
    }

    @computed private get selectedPoints() {
        const seriesNamesSet = this.getSeriesNamesToShow(true)
        return this.allPoints.filter(
            (point) => point.entityName && seriesNamesSet.has(point.entityName)
        )
    }

    @computed private get pointsForAxisDomains() {
        if (
            !this.transformedTable.numSelectedEntities ||
            !this.manager.zoomToSelection
        )
            return this.currentValues

        return this.selectedPoints.length
            ? this.selectedPoints
            : this.currentValues
    }

    @computed private get sizeDomain(): [number, number] {
        const sizeValues: number[] = []
        this.allPoints.forEach(
            (point) => point.size && sizeValues.push(point.size)
        )
        if (sizeValues.length === 0) return [1, 100]
        else return domainExtent(sizeValues, ScaleType.linear)
    }

    @computed private get yScaleType() {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : this.yAxisConfig.scaleType || ScaleType.linear
    }

    @computed private get yDomainDefault() {
        return this.domainDefault("y")
    }

    @computed private get verticalAxisPart() {
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

    @computed private get xScaleType() {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : this.xAxisConfig.scaleType ?? ScaleType.linear
    }

    @computed private get xAxisLabelBase() {
        const xDimName = this.xColumn?.displayName
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed private get horizontalAxisPart() {
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

    // todo: refactor/remove and/or add unit tests
    @computed get series() {
        const { yColumn, transformedTable, xColumn } = this
        if (!yColumn || !xColumn) return []

        const seriesArr: ScatterSeries[] = []
        const strat = this.manager.scatterPointLabelStrategy

        // As needed, join the individual year data points together to create an "arrow chart"
        this.getPointsByEntityAndTime().forEach((pointsByTime, seriesName) => {
            const series = {
                seriesName,
                label: seriesName,
                color: "#932834", // Default color, used when no color dimension is present
                size: 0,
                points: [],
            } as ScatterSeries

            pointsByTime.forEach((point) => {
                let label
                if (strat === ScatterPointLabelStrategy.year)
                    label = transformedTable.timeColumnFormatFunction(
                        point.timeValue
                    )
                else if (strat === ScatterPointLabelStrategy.x)
                    label = xColumn.formatValue(point.x)
                else
                    (label = yColumn.formatValue(point.y)),
                        series.points.push({ ...point, label })
            })

            // Use most recent size and color values
            // const lastPoint = last(series.values)

            if (series.points.length) {
                const keyColor = transformedTable.getColorForEntityName(
                    seriesName
                )
                if (keyColor !== undefined) series.color = keyColor
                else if (this.colorColumn) {
                    const colorValue = last(
                        series.points.map((point) => point.color)
                    )
                    const color = this.colorScale.getColor(colorValue)
                    if (color !== undefined) {
                        series.color = color
                        series.isScaleColor = true
                    }
                }
                const sizes = series.points.map((v) => v.size)
                series.size = last(sizes.filter((s) => isNumber(s))) ?? 0
                seriesArr.push(series)
            }
        })

        return seriesArr
    }
}
