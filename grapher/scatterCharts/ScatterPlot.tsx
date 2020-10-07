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
    keyBy,
    isNumber,
    has,
    groupBy,
    map,
    sortedFindClosestIndex,
    domainExtent,
    minBy,
    sortNumeric,
    lowerCaseFirstLetterUnlessAbbreviation,
    relativeMinAndMax,
    identity,
} from "grapher/utils/Util"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { NoDataModal } from "grapher/noDataModal/NoDataModal"
import {
    BASE_FONT_SIZE,
    ScaleType,
    Time,
    DimensionProperty,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
} from "grapher/core/GrapherConstants"
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
import { EntityName } from "coreTable/CoreTableConstants"
import { AbstractCoreColumn } from "coreTable/CoreTable"
import { ColorScale, ColorScaleManager } from "grapher/color/ColorScale"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    ScatterPlotManager,
    ScatterSeries,
    SeriesPoint,
} from "./ScatterPlotConstants"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"
import { ScatterTooltip } from "./ScatterTooltip"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"

@observer
export class ScatterPlot
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
    @observable hoveredSeries?: EntityName
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get manager() {
        return this.props.manager
    }

    @computed.struct get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get canAddCountry() {
        const { addCountryMode } = this.manager
        return addCountryMode && addCountryMode !== EntitySelectionMode.Disabled
    }

    @action.bound onSelectEntity(entityName: EntityName) {
        if (this.canAddCountry) this.table.toggleSelection(entityName)
    }

    // Only want to show colors on legend that are actually on the chart right now
    @computed get colorsInUse() {
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
        const { hoverColor, table } = this
        if (!this.canAddCountry || hoverColor === undefined) return

        const keysToToggle = this.series
            .filter((g) => g.color === hoverColor)
            .map((g) => g.seriesName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedEntityNames).length ===
            keysToToggle.length
        if (allKeysActive)
            table.setSelectedEntities(
                without(this.selectedEntityNames, ...keysToToggle)
            )
        else
            table.setSelectedEntities(
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
    @computed get hoveredSeriesNames() {
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
        return this.table.selectedEntityNames
    }

    @computed get displayStartTime() {
        return this.table.timeColumnFormatFunction(this.table.minTime ?? 1900)
    }

    @computed get displayEndTime() {
        return this.table.timeColumnFormatFunction(this.table.maxTime ?? 2000)
    }

    @computed get maxLegendWidth() {
        return this.sidebarWidth
    }

    @computed private get arrowLegend() {
        if (
            this.displayStartTime === this.displayEndTime ||
            this.manager.isRelativeMode
        )
            return undefined

        return new ConnectedScatterLegend(this)
    }

    @action.bound onScatterMouseOver(series: ScatterSeries) {
        this.hoveredSeries = series.seriesName
    }

    @action.bound onScatterMouseLeave() {
        this.hoveredSeries = undefined
    }

    @action.bound onScatterClick() {
        if (this.hoveredSeries) this.onSelectEntity(this.hoveredSeries)
    }

    @computed get tooltipSeries() {
        const { hoveredSeries, focusedEntityNames } = this
        if (hoveredSeries !== undefined)
            return this.series.find((g) => g.seriesName === hoveredSeries)
        if (focusedEntityNames && focusedEntityNames.length === 1)
            return this.series.find(
                (g) => g.seriesName === focusedEntityNames[0]
            )
        return undefined
    }

    @computed get sidebarMaxWidth() {
        return Math.max(this.bounds.width * 0.2, this.sidebarMinWidth)
    }
    @computed get sidebarMinWidth() {
        return Math.max(this.bounds.width * 0.1, 60)
    }
    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legendDimensions } = this
        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    // todo: Refactor
    @computed private get dualAxis() {
        const { horizontalAxis, verticalAxis } = this
        const axis = new DualAxis({
            bounds: this.bounds.padRight(this.sidebarWidth + 20),
            horizontalAxis,
            verticalAxis,
        })

        return axis
    }

    @computed private get comparisonLines() {
        return this.manager.comparisonLines
    }

    @action.bound onToggleEndpoints() {
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

    @computed get hideLines() {
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

    @computed get colorColumn() {
        return this.table.get(this.manager.colorColumnSlug)
    }

    @computed get colorBins() {
        return this.colorScale.legendBins.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get title() {
        return this.colorScale.legendDescription
    }

    @computed private get legendDimensions(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
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
            this.manager.yAxis || new AxisConfig(this.manager.yAxisConfig, this)
        )
    }

    @computed private get xAxisConfig() {
        return (
            this.manager.xAxis || new AxisConfig(this.manager.xAxisConfig, this)
        )
    }

    @computed private get yColumnSlug() {
        const { yColumnSlug, yColumnSlugs, table } = this.manager
        const ySlugs = yColumnSlugs || []
        return yColumnSlug ?? ySlugs[0] ?? table.numericColumnSlugs[0]
    }

    @computed private get yColumn() {
        return this.table.get(this.yColumnSlug)
    }

    @computed private get xColumnSlug() {
        const { xColumnSlug, table } = this.manager
        return xColumnSlug ?? table.numericColumnSlugs[1]
    }

    @computed private get xColumn() {
        return this.table.get(this.xColumnSlug)
    }

    @computed private get sizeColumn() {
        return this.table.get(this.manager.sizeColumnSlug)
    }

    @computed get failMessage() {
        if (!this.yColumn) return "Missing Y axis variable"

        if (!this.xColumn) return "Missing X axis variable"

        if (isEmpty(this.possibleEntityNames))
            return "No entities with data for both X and Y"

        if (isEmpty(this.possibleDataTimes))
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

    @computed private get possibleEntityNames(): EntityName[] {
        const yEntities = this.yColumn ? this.yColumn.entityNamesUniqArr : []
        const xEntities = this.xColumn ? this.xColumn.entityNamesUniqArr : []
        return intersection(yEntities, xEntities)
    }

    // todo: remove. do this at table filter level
    getEntityNamesToShow(
        filterBackgroundEntities = this.hideBackgroundEntities
    ): EntityName[] {
        let entityNames = filterBackgroundEntities
            ? this.table.selectedEntityNames
            : this.possibleEntityNames

        if (this.manager.matchingEntitiesOnly && this.colorColumn)
            entityNames = intersection(
                entityNames,
                this.colorColumn.entityNamesUniqArr
            )

        return entityNames
    }

    // The times for which there MAY be data on the scatterplot
    // Not all of these will necessarily end up on the timeline, because there may be no x/y entity overlap for that time
    // e.g. https://ourworldindata.org/grapher/life-expectancy-years-vs-real-gdp-per-capita-2011us
    @computed private get possibleDataTimes(): Time[] {
        const yDimensionTimes = this.yColumn ? this.yColumn.timesUniq : []
        const xDimensionTimes = this.xColumn ? this.xColumn.timesUniq : []

        if (this.xOverrideTime !== undefined) return yDimensionTimes

        return intersection(yDimensionTimes, xDimensionTimes)
    }

    // The times for which we intend to calculate output data
    @computed private get timesToCalculate(): Time[] {
        return this.possibleDataTimes
    }

    @computed get compareEndPointsOnly() {
        return !!this.manager.compareEndPointsOnly
    }

    set compareEndPointsOnly(value: boolean) {
        this.manager.compareEndPointsOnly = value || undefined
    }

    @computed private get columns() {
        return [
            this.yColumn,
            this.xColumn,
            this.colorColumn,
            this.sizeColumn,
        ].filter(identity) as AbstractCoreColumn[]
    }

    // todo: move this sort of thing to OwidTable
    // todo: add unit tests for this thing
    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    private getDataByEntityAndTime(
        entitiesToShow = this.getEntityNamesToShow()
    ): Map<EntityName, Map<Time, SeriesPoint>> {
        const { columns } = this
        const validEntityLookup = keyBy(entitiesToShow)

        const dataByEntityAndTime = new Map<
            EntityName,
            Map<Time, SeriesPoint>
        >()

        for (const column of columns) {
            // First, we organize the data by entity
            const initialDataByEntity = new Map<
                EntityName,
                { times: Time[]; values: (string | number)[] }
            >()
            const rows = column.rowsWithValue
            column.parsedValues.forEach((value, index) => {
                const row = rows[index]
                const time = row.year ?? row.day
                const entityName = row.entityName

                if (!validEntityLookup[entityName]) return
                if (
                    (column === this.xColumn || column === this.yColumn) &&
                    !isNumber(value)
                )
                    return

                let byEntity = initialDataByEntity.get(entityName)
                if (!byEntity) {
                    byEntity = { times: [], values: [] }
                    initialDataByEntity.set(entityName, byEntity)
                }

                byEntity.times.push(time)
                byEntity.values.push(value)
            })

            this._useTolerance(column, dataByEntityAndTime, initialDataByEntity)
        }

        this._removeUnwantedPoints(dataByEntityAndTime)

        return dataByEntityAndTime
    }

    private _useTolerance(
        column: AbstractCoreColumn,
        dataByEntityAndTime: Map<EntityName, Map<Time, SeriesPoint>>,
        initialDataByEntity: Map<
            EntityName,
            { times: Time[]; values: (string | number)[] }
        >
    ) {
        const { timesToCalculate, xOverrideTime } = this
        const tolerance =
            column === this.sizeColumn ? Infinity : column.tolerance

        // Now go through each entity + timeline year and use a binary search to find the closest
        // matching data year within tolerance
        // NOTE: this code assumes years is sorted asc!!!
        initialDataByEntity.forEach((byEntity, entityName) => {
            let dataByYear = dataByEntityAndTime.get(entityName)
            if (dataByYear === undefined) {
                dataByYear = new Map<Time, SeriesPoint>()
                dataByEntityAndTime.set(entityName, dataByYear)
            }

            const property = this.columnToPropertyMap.get(column)!

            for (const outputYear of timesToCalculate) {
                const targetYear =
                    xOverrideTime !== undefined && column === this.xColumn
                        ? xOverrideTime
                        : outputYear
                const i = sortedFindClosestIndex(byEntity.times, targetYear)
                const year = byEntity.times[i]

                // Skip years that aren't within tolerance of the target
                if (
                    year < targetYear - tolerance ||
                    year > targetYear + tolerance
                ) {
                    continue
                }

                const value = byEntity.values[i]

                let point = dataByYear.get(outputYear)
                if (point === undefined) {
                    point = {
                        entityName,
                        year: outputYear,
                        time: {},
                    } as SeriesPoint
                    dataByYear.set(outputYear, point)
                }

                ;(point as any).time[property] = year
                ;(point as any)[property] = value
            }
        })
    }

    @computed get columnToPropertyMap() {
        const map = new Map()
        map.set(this.xColumn, DimensionProperty.x)
        map.set(this.yColumn, DimensionProperty.y)
        map.set(this.sizeColumn, DimensionProperty.size)
        map.set(this.colorColumn, DimensionProperty.color)
        return map
    }

    private _removeUnwantedPoints(
        dataByEntityAndTime: Map<EntityName, Map<Time, SeriesPoint>>
    ) {
        // The exclusion of points happens as a last step in order to avoid artefacts due to
        // the tolerance calculation. E.g. if we pre-filter the data based on the X and Y
        // domains before creating the points, the tolerance may lead to different X-Y
        // values being joined.
        // -@danielgavrilov, 2020-04-29
        const { yAxisConfig, xAxisConfig } = this
        dataByEntityAndTime.forEach((dataByTime) => {
            dataByTime.forEach((point, time) => {
                // Exclude any points with data for only one axis
                if (!has(point, "x") || !has(point, "y"))
                    dataByTime.delete(time)
                // Exclude points that go beyond min/max of X axis
                else if (xAxisConfig.shouldRemovePoint(point.x))
                    dataByTime.delete(time)
                // Exclude points that go beyond min/max of Y axis
                else if (yAxisConfig.shouldRemovePoint(point.y))
                    dataByTime.delete(time)
            })
        })
    }

    @computed get allPoints() {
        const allPoints: SeriesPoint[] = []
        this.getDataByEntityAndTime().forEach((dataByTime) => {
            dataByTime.forEach((point) => {
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
                this.pointsForAxisDomains.map((d) => d[property]),
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
        const entitiesFor = new Set(this.getEntityNamesToShow(true))
        return this.allPoints.filter(
            (point) => point.entityName && entitiesFor.has(point.entityName)
        )
    }

    @computed private get pointsForAxisDomains() {
        if (!this.table.numSelectedEntities || !this.manager.zoomToSelection)
            return this.currentValues

        return this.selectedPoints.length
            ? this.selectedPoints
            : this.currentValues
    }

    @computed get sizeDomain(): [number, number] {
        const sizeValues: number[] = []
        this.allPoints.forEach((g) => g.size && sizeValues.push(g.size))
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

    @computed get verticalAxis() {
        const { manager, yDomainDefault } = this
        const axisConfig = this.yAxisConfig

        const axis = axisConfig.toVerticalAxis()
        axis.formatColumn = this.yColumn
        const label = axisConfig.label || this.yColumn?.displayName || ""
        axis.scaleType = this.yScaleType

        if (manager.isRelativeMode) {
            axis.scaleTypeOptions = [ScaleType.linear]
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
            : this.xAxisConfig.scaleType || ScaleType.linear
    }

    @computed private get xAxisLabelBase() {
        const xDimName = this.xColumn?.displayName
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed get horizontalAxis() {
        const { xDomainDefault, manager, xAxisLabelBase } = this
        const { xAxisConfig } = this
        const axis = xAxisConfig.toHorizontalAxis()
        axis.formatColumn = this.xColumn
        axis.scaleType = this.xScaleType
        if (manager.isRelativeMode) {
            axis.scaleTypeOptions = [ScaleType.linear]
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

    // todo: add unit tests
    private _filterValues(
        values: SeriesPoint[],
        startTime: Time,
        endTime: Time,
        yScaleType: ScaleType,
        xScaleType: ScaleType,
        isRelativeMode: boolean,
        xOverrideTime?: Time
    ) {
        // Only allow tolerance data to occur once in any given chart (no duplicate data points)
        // Prioritize the start and end years first, then the "true" year

        // NOTE: since groupBy() creates an object, the values may be reordered. we reorder a few lines below.
        values = map(
            groupBy(values, (v) => v.time.y),
            (vals: SeriesPoint[]) =>
                minBy(vals, (v) =>
                    v.year === startTime || v.year === endTime
                        ? -Infinity
                        : Math.abs(v.year - v.time.y)
                ) as SeriesPoint
        )

        if (xOverrideTime === undefined) {
            // NOTE: since groupBy() creates an object, the values may be reordered
            values = map(
                groupBy(values, (v) => v.time.x),
                (vals: SeriesPoint[]) =>
                    minBy(vals, (v) =>
                        v.year === startTime || v.year === endTime
                            ? -Infinity
                            : Math.abs(v.year - v.time.x)
                    ) as SeriesPoint
            )
        }

        // Sort values by year again in case groupBy() above reordered the values
        values = sortNumeric(values, (v) => v.year)

        // Don't allow values <= 0 for log scales
        if (yScaleType === ScaleType.log) values = values.filter((v) => v.y > 0)
        if (xScaleType === ScaleType.log) values = values.filter((v) => v.x > 0)

        // Don't allow values *equal* to zero for CAGR mode
        if (isRelativeMode)
            values = values.filter((v) => v.y !== 0 && v.x !== 0)

        return values
    }

    @computed get table() {
        return this.manager.table
    }

    // todo: refactor/remove and/or add unit tests
    @computed get series() {
        const { yColumn } = this
        if (!yColumn) return []

        const { table, xColumn } = this

        const seriesArr: ScatterSeries[] = []
        const strat = this.manager.scatterPointLabelStrategy

        // As needed, join the individual year data points together to create an "arrow chart"
        this.getDataByEntityAndTime().forEach((dataByTime, entityName) => {
            const series = {
                seriesName: entityName,
                label: entityName,
                color: "#932834", // Default color, used when no color dimension is present
                size: 0,
                points: [],
            } as ScatterSeries

            dataByTime.forEach((point) => {
                let label
                if (strat === ScatterPointLabelStrategy.year)
                    label = table.timeColumnFormatFunction(point.time)
                else if (strat === ScatterPointLabelStrategy.x)
                    label = xColumn!.formatValue(point.x)
                else
                    (label = yColumn!.formatValue(point.y)),
                        series.points.push({ ...point, label })
            })

            // Use most recent size and color values
            // const lastPoint = last(series.values)

            if (series.points.length) {
                const keyColor = table.getColorForEntityName(entityName)
                if (keyColor !== undefined) {
                    series.color = keyColor
                } else if (this.colorColumn) {
                    const colorValue = last(series.points.map((v) => v.color))
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

        // currentData.forEach((series) => {
        //     series.values = this._filterValues(
        //         series.values,
        //         startTimelineTime,
        //         endTimelineTime,
        //         yScaleType,
        //         xScaleType,
        //         isRelativeMode,
        //         xOverrideTime
        //     )
        // })

        // currentData = currentData.filter((series) => {
        //     // No point trying to render series with no valid points!
        //     if (series.points.length === 0) return false

        //     // // Hide lines which don't cover the full span
        //     // if (this.hideLinesOutsideTolerance)
        //     //     return (
        //     //         firstOfNonEmptyArray(series.values).year ===
        //     //             startTimelineTime &&
        //     //         lastOfNonEmptyArray(series.values).year === endTimelineTime
        //     //     )

        //     return true
        // })

        // if (compareEndPointsOnly) {
        //     currentData.forEach((series) => {
        //         const endPoints = [first(series.points), last(series.points)]
        //         series.points = compact(uniq(endPoints))
        //     })
        // }

        // if (isRelativeMode) {
        //     currentData.forEach((series) => {
        //         if (series.points.length === 0) return
        //         const startValue = firstOfNonEmptyArray(series.points)
        //         const endValue = lastOfNonEmptyArray(series.points)

        //         series.points = [
        //             {
        //                 x: cagr(startValue, endValue, "x"),
        //                 y: cagr(startValue, endValue, "y"),
        //                 size: endValue.size,
        //                 year: endValue.year,
        //                 color: endValue.color,
        //                 label: "s",
        //                 time: {
        //                     y: endValue.time.y,
        //                     x: endValue.time.x,
        //                     span: [startValue.time.y, endValue.time.y],
        //                 },
        //             },
        //         ]
        //     })
        // }

        return seriesArr
    }
}
