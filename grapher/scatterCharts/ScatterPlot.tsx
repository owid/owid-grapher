import * as React from "react"
import { observable, computed, action } from "mobx"
import {
    intersection,
    without,
    compact,
    uniq,
    first,
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
    defaultTo,
    domainExtent,
    minBy,
    sortNumeric,
    lowerCaseFirstLetterUnlessAbbreviation,
    relativeMinAndMax,
    identity,
    min,
    guid,
    getRelativeMouse,
    makeSafeForCSS,
} from "grapher/utils/Util"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { NoDataModal } from "grapher/chart/NoDataModal"
import { scaleLinear } from "d3-scale"
import { PointVector } from "grapher/utils/PointVector"
import { Triangle } from "./Triangle"
import { select } from "d3-selection"
import { getElementWithHalo } from "./Halos"
import {
    SortOrder,
    BASE_FONT_SIZE,
    ScaleType,
    Time,
    DimensionProperty,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
} from "grapher/core/GrapherConstants"
import { MultiColorPolyline } from "./MultiColorPolyline"
import { TextWrap } from "grapher/text/TextWrap"
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
    ScatterTooltipProps,
    ScatterRenderSeries,
    ScatterLabel,
    ScatterRenderPoint,
    PointsWithLabelsProps,
    ScatterLabelFontFamily,
} from "./ScatterPlotConstants"
import {
    labelPriority,
    makeEndLabel,
    makeMidLabels,
    makeStartLabel,
} from "./ScatterUtils"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"

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
    @observable hoverKey?: EntityName
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

        const keysToToggle = this.marks
            .filter((g) => g.color === hoverColor)
            .map((g) => g.entityName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedKeys).length ===
            keysToToggle.length
        if (allKeysActive)
            table.setSelectedEntities(
                without(this.selectedKeys, ...keysToToggle)
            )
        else
            table.setSelectedEntities(
                uniq(this.selectedKeys.concat(keysToToggle))
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors() {
        const { colorsInUse } = this
        return colorsInUse.filter((color) => {
            const matchingKeys = this.marks
                .filter((g) => g.color === color)
                .map((g) => g.entityName)
            return (
                intersection(matchingKeys, this.selectedKeys).length ===
                matchingKeys.length
            )
        })
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys() {
        const { hoverColor, hoverKey } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.marks
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.entityName)
                  )

        if (hoverKey !== undefined) hoverKeys.push(hoverKey)

        return hoverKeys
    }

    @computed private get focusKeys() {
        return this.selectedKeys
    }

    @computed private get selectedKeys() {
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
        this.hoverKey = series.entityName
    }

    @action.bound onScatterMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onScatterClick() {
        if (this.hoverKey) this.onSelectEntity(this.hoverKey)
    }

    @computed get tooltipSeries() {
        const { hoverKey, focusKeys } = this
        if (hoverKey !== undefined)
            return this.marks.find((g) => g.entityName === hoverKey)
        if (focusKeys && focusKeys.length === 1)
            return this.marks.find((g) => g.entityName === focusKeys[0])
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
        const { hoverKeys, focusKeys } = this
        const activeKeys = hoverKeys.concat(focusKeys)

        let series = this.marks

        if (activeKeys.length)
            series = series.filter((g) => activeKeys.includes(g.entityName))

        const colorValues = uniq(
            flatten(series.map((s) => s.points.map((p) => p.color)))
        )
        return excludeUndefined(colorValues.map(this.colorScale.getColor))
    }

    @computed get hideLines() {
        return !!this.manager.hideConnectedScatterLines
    }

    @computed private get points() {
        const { dualAxis, focusKeys, hoverKeys, hideLines, manager } = this

        const { marks, sizeDomain, colorScale } = this

        return (
            <PointsWithLabels
                noDataModalManager={manager}
                hideLines={hideLines}
                seriesArray={marks}
                dualAxis={dualAxis}
                colorScale={this.colorColumn ? colorScale : undefined}
                sizeDomain={sizeDomain}
                focusKeys={focusKeys}
                hoverKeys={hoverKeys}
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
                    isInteractive={manager.isInteractive}
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

    @computed private get yAxis() {
        return this.manager.yAxis || new AxisConfig(undefined, this)
    }

    @computed private get xAxis() {
        return this.manager.xAxis || new AxisConfig(undefined, this)
    }

    @computed private get yColumn() {
        return this.table.get(
            this.manager.yColumnSlug ?? this.manager.yColumnSlugs![0]
        )
    }

    @computed private get xColumn() {
        return this.table.get(this.manager.xColumnSlug)
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

        if (isEmpty(this.marks)) return "No matching data"

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
        const { yAxis, xAxis } = this
        dataByEntityAndTime.forEach((dataByTime) => {
            dataByTime.forEach((point, time) => {
                // Exclude any points with data for only one axis
                if (!has(point, "x") || !has(point, "y"))
                    dataByTime.delete(time)
                // Exclude points that go beyond min/max of X axis
                else if (xAxis.shouldRemovePoint(point.x))
                    dataByTime.delete(time)
                // Exclude points that go beyond min/max of Y axis
                else if (yAxis.shouldRemovePoint(point.y))
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

    // The selectable years that will end up on the timeline UI (if enabled)
    @computed get availableTimes(): Time[] {
        return this.allPoints.map((point) => point.year)
    }

    @computed private get currentValues() {
        return flatten(this.marks.map((g) => g.points))
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
        if (
            !this.table.selectedEntityNames.length ||
            !this.manager.zoomToSelection
        )
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
            : this.yAxis.scaleType || ScaleType.linear
    }

    @computed private get yAxisLabel() {
        return this.yAxis.label || this.yColumn?.displayName || ""
    }

    @computed private get yDomainDefault() {
        return this.domainDefault("y")
    }

    @computed get verticalAxis() {
        const { manager, yDomainDefault } = this

        const axis = this.yAxis.toVerticalAxis()
        axis.formatColumn = this.yColumn

        const label = this.yAxisLabel

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
            : this.xAxis.scaleType || ScaleType.linear
    }

    @computed private get xAxisLabelBase() {
        const xDimName = this.xColumn?.displayName
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed get horizontalAxis() {
        const { xDomainDefault, manager, xAxisLabelBase } = this

        const { xAxis } = this

        const axis = xAxis.toHorizontalAxis()
        axis.formatColumn = this.xColumn

        axis.scaleType = this.xScaleType
        if (manager.isRelativeMode) {
            axis.scaleTypeOptions = [ScaleType.linear]
            axis.domain = xDomainDefault // Overwrite user's min/max
            const label = xAxis.label || xAxisLabelBase
            if (label && label.length > 1) {
                axis.label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                    label
                )}`
            }
        } else {
            axis.updateDomainPreservingUserSettings(xDomainDefault)
            const label = xAxis.label || xAxisLabelBase
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
    @computed get marks() {
        const { yColumn } = this
        if (!yColumn) return []

        const { table, xColumn } = this

        const seriesArr: ScatterSeries[] = []
        const strat = this.manager.scatterPointLabelStrategy

        // As needed, join the individual year data points together to create an "arrow chart"
        this.getDataByEntityAndTime().forEach((dataByTime, entityName) => {
            const group = {
                entityName,
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
                        group.points.push({ ...point, label })
            })

            // Use most recent size and color values
            // const lastPoint = last(group.values)

            if (group.points.length) {
                const keyColor = table.getColorForEntityName(entityName)
                if (keyColor !== undefined) {
                    group.color = keyColor
                } else if (this.colorColumn) {
                    const colorValue = last(group.points.map((v) => v.color))
                    const color = this.colorScale.getColor(colorValue)
                    if (color !== undefined) {
                        group.color = color
                        group.isScaleColor = true
                    }
                }
                const sizes = group.points.map((v) => v.size)
                group.size = defaultTo(
                    last(sizes.filter((s) => isNumber(s))),
                    0
                )
                seriesArr.push(group)
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

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValueY(value: SeriesPoint) {
        return "Y Axis: " + this.props.yColumn.formatValue(value.y)
    }

    formatValueX(value: SeriesPoint) {
        let s = `X Axis: ${this.props.xColumn.formatValue(value.x)}`
        if (!value.time.span && value.time.y !== value.time.x)
            s += ` (data from ${this.props.xColumn.table.formatTime(
                value.time.x
            )})`
        return s
    }

    render() {
        const { x, y, maxWidth, fontSize, series } = this.props
        const lineHeight = 5

        const firstValue = first(series.points)
        const lastValue = last(series.points)
        const values = compact(uniq([firstValue, lastValue]))

        const elements: Array<{ x: number; y: number; wrap: TextWrap }> = []
        let offset = 0

        const heading = {
            x: x,
            y: y + offset,
            wrap: new TextWrap({
                maxWidth: maxWidth,
                fontSize: 0.75 * fontSize,
                text: series.label,
            }),
        }
        elements.push(heading)
        offset += heading.wrap.height + lineHeight

        const { yColumn } = this.props

        values.forEach((v) => {
            const year = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.65 * fontSize,
                    text: v.time.span
                        ? `${yColumn.table.formatTime(
                              v.time.span[0]
                          )} to ${yColumn.table.formatTime(v.time.span[1])}`
                        : yColumn.table.formatTime(v.time.y),
                }),
            }
            offset += year.wrap.height
            const line1 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueY(v),
                }),
            }
            offset += line1.wrap.height
            const line2 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueX(v),
                }),
            }
            offset += line2.wrap.height + lineHeight
            elements.push(...[year, line1, line2])
        })

        return (
            <g className="scatterTooltip">
                {elements.map((el, i) =>
                    el.wrap.render(el.x, el.y, { key: i })
                )}
            </g>
        )
    }
}

// todo: readd
@observer
export class TimeScatter extends ScatterPlot {
    constructor(props: any) {
        super(props)
    }
}

// When there's only a single point in a group (e.g. single year mode)
@observer
class ScatterGroupSingle extends React.Component<{
    group: ScatterRenderSeries
    isLayerMode?: boolean
    isConnected?: boolean
}> {
    render() {
        const { group, isLayerMode, isConnected } = this.props
        const value = first(group.points)
        if (value === undefined) return null

        const color = group.isFocus || !isLayerMode ? value.color : "#e2e2e2"

        const isLabelled = group.allLabels.some((label) => !label.isHidden)
        const size =
            !group.isFocus && isConnected ? 1 + value.size / 16 : value.size
        const cx = value.position.x.toFixed(2)
        const cy = value.position.y.toFixed(2)
        const stroke = isLayerMode ? "#bbb" : isLabelled ? "#333" : "#666"

        return (
            <g key={group.displayKey} className={group.displayKey}>
                {group.isFocus && (
                    <circle
                        cx={cx}
                        cy={cy}
                        fill="none"
                        stroke={color}
                        r={(size + 3).toFixed(2)}
                    />
                )}
                <circle
                    cx={cx}
                    cy={cy}
                    r={size.toFixed(2)}
                    fill={color}
                    opacity={0.8}
                    stroke={stroke}
                    strokeWidth={0.5}
                />
            </g>
        )
    }
}

@observer
class ScatterBackgroundLine extends React.Component<{
    group: ScatterRenderSeries
    isLayerMode: boolean
    isConnected: boolean
}> {
    render() {
        const { group, isLayerMode, isConnected } = this.props

        if (group.points.length === 1)
            return (
                <ScatterGroupSingle
                    group={group}
                    isLayerMode={isLayerMode}
                    isConnected={isConnected}
                />
            )

        const firstValue = first(group.points)
        const lastValue = last(group.points)
        if (firstValue === undefined || lastValue === undefined) return null

        let rotation = PointVector.angle(group.offsetVector, PointVector.up)
        if (group.offsetVector.x < 0) rotation = -rotation

        const opacity = 0.7

        return (
            <g key={group.displayKey} className={group.displayKey}>
                <circle
                    cx={firstValue.position.x.toFixed(2)}
                    cy={firstValue.position.y.toFixed(2)}
                    r={(1 + firstValue.size / 25).toFixed(1)}
                    fill={isLayerMode ? "#e2e2e2" : firstValue.color}
                    stroke="none"
                    opacity={opacity}
                />
                <MultiColorPolyline
                    points={group.points.map((v) => ({
                        x: v.position.x,
                        y: v.position.y,
                        color: isLayerMode ? "#ccc" : v.color,
                    }))}
                    strokeWidth={(0.3 + group.size / 16).toFixed(2)}
                    opacity={opacity}
                />
                <Triangle
                    transform={`rotate(${rotation}, ${lastValue.position.x.toFixed(
                        2
                    )}, ${lastValue.position.y.toFixed(2)})`}
                    cx={lastValue.position.x}
                    cy={lastValue.position.y}
                    r={1.5 + lastValue.size / 16}
                    fill={isLayerMode ? "#e2e2e2" : lastValue.color}
                    opacity={opacity}
                />
            </g>
        )
    }
}

@observer
class PointsWithLabels extends React.Component<PointsWithLabelsProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @computed private get seriesArray() {
        return this.props.seriesArray
    }

    @computed private get isConnected() {
        return this.seriesArray.some((g) => g.points.length > 1)
    }

    @computed private get focusKeys() {
        return intersection(
            this.props.focusKeys || [],
            this.seriesArray.map((g) => g.entityName)
        )
    }

    @computed private get hoverKeys() {
        return this.props.hoverKeys
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed private get isLayerMode() {
        return this.focusKeys.length > 0 || this.hoverKeys.length > 0
    }

    @computed private get bounds() {
        return this.props.dualAxis.innerBounds
    }

    // When focusing multiple entities, we hide some information to declutter
    @computed private get isSubtleForeground() {
        return (
            this.focusKeys.length > 1 &&
            this.props.seriesArray.some((series) => series.points.length > 2)
        )
    }

    @computed private get colorScale() {
        return this.props.colorScale
    }

    @computed private get sizeScale() {
        const sizeScale = scaleLinear()
            .range([10, 1000])
            .domain(this.props.sizeDomain)
        return sizeScale
    }

    @computed private get fontScale(): (d: number) => number {
        return scaleLinear().range([10, 13]).domain(this.sizeScale.domain())
    }

    @computed private get hideLines() {
        return this.props.hideLines
    }

    // Pre-transform data for rendering
    @computed private get initialRenderData(): ScatterRenderSeries[] {
        const { seriesArray, sizeScale, fontScale, colorScale, bounds } = this
        const xAxis = this.props.dualAxis.horizontalAxis.clone()
        xAxis.range = bounds.xRange()
        const yAxis = this.props.dualAxis.verticalAxis.clone()
        yAxis.range = this.bounds.yRange()

        return sortNumeric(
            seriesArray.map((series) => {
                const points = series.points.map((point) => {
                    const area = sizeScale(point.size || 4)
                    const scaleColor =
                        colorScale !== undefined
                            ? colorScale.getColor(point.color)
                            : undefined
                    return {
                        position: new PointVector(
                            Math.floor(xAxis.place(point.x)),
                            Math.floor(yAxis.place(point.y))
                        ),
                        color: scaleColor ?? series.color,
                        size: Math.sqrt(area / Math.PI),
                        fontSize: fontScale(series.size || 1),
                        time: point.time,
                        label: point.label,
                    }
                })

                return {
                    entityName: series.entityName,
                    displayKey: "key-" + makeSafeForCSS(series.entityName),
                    color: series.color,
                    size: (last(points) as any).size,
                    points,
                    text: series.label,
                    midLabels: [],
                    allLabels: [],
                    offsetVector: PointVector.zero,
                }
            }),
            (d) => d.size,
            SortOrder.desc
        )
    }

    @computed private get renderData(): ScatterRenderSeries[] {
        // Draw the largest points first so that smaller ones can sit on top of them
        const renderData = this.initialRenderData

        for (const series of renderData) {
            series.isHover = this.hoverKeys.includes(series.entityName)
            series.isFocus = this.focusKeys.includes(series.entityName)
            series.isForeground = series.isHover || series.isFocus
            if (series.isHover) series.size += 1
        }

        for (const series of renderData) {
            series.startLabel = makeStartLabel(series, this.isSubtleForeground)
            series.midLabels = makeMidLabels(series, this.isSubtleForeground)
            series.endLabel = makeEndLabel(
                series,
                this.isSubtleForeground,
                this.hideLines
            )
            series.allLabels = [series.startLabel]
                .concat(series.midLabels)
                .concat([series.endLabel])
                .filter((x) => x) as ScatterLabel[]
        }

        const labels = flatten(renderData.map((series) => series.allLabels))

        // Ensure labels fit inside bounds
        // Must do before collision detection since it'll change the positions
        this.moveLabelsInsideChartBounds(labels, this.bounds)

        const labelsByPriority = sortNumeric(
            labels,
            (l) => labelPriority(l),
            SortOrder.desc
        )
        if (this.focusKeys.length > 0)
            this.hideUnselectedLabels(labelsByPriority)

        this.hideCollidingLabelsByPriority(labelsByPriority)

        return renderData
    }

    private hideUnselectedLabels(labelsByPriority: ScatterLabel[]) {
        labelsByPriority
            .filter((label) => !label.series.isFocus && !label.series.isHover)
            .forEach((label) => (label.isHidden = true))
    }

    private hideCollidingLabelsByPriority(labelsByPriority: ScatterLabel[]) {
        for (let i = 0; i < labelsByPriority.length; i++) {
            const higherPriorityLabel = labelsByPriority[i]
            if (higherPriorityLabel.isHidden) continue

            for (let j = i + 1; j < labelsByPriority.length; j++) {
                const lowerPriorityLabel = labelsByPriority[j]
                if (lowerPriorityLabel.isHidden) continue

                const isHighlightedEndLabelOfEqualPriority =
                    lowerPriorityLabel.isEnd &&
                    (lowerPriorityLabel.series.isHover ||
                        lowerPriorityLabel.series.isFocus) &&
                    higherPriorityLabel.series.isHover ===
                        lowerPriorityLabel.series.isHover &&
                    higherPriorityLabel.series.isFocus ===
                        lowerPriorityLabel.series.isFocus

                if (
                    isHighlightedEndLabelOfEqualPriority
                        ? // For highlighted end labels of equal priority, we want to allow some
                          // overlap – labels are still readable even if they overlap
                          higherPriorityLabel.bounds
                              .pad(6) // allow up to 6px of overlap
                              .intersects(lowerPriorityLabel.bounds)
                        : // For non-highlighted labels we want to leave more space between labels,
                          // partly to have a less noisy chart, and partly to prevent readers from
                          // thinking that "everything is labelled". In the past this has made
                          // readers think that if a label doesn't exist, it isn't plotted on the
                          // chart.
                          higherPriorityLabel.bounds
                              .pad(-6)
                              .intersects(lowerPriorityLabel.bounds)
                ) {
                    lowerPriorityLabel.isHidden = true
                }
            }
        }
    }

    // todo: move this to bounds class with a test
    private moveLabelsInsideChartBounds(
        labels: ScatterLabel[],
        bounds: Bounds
    ) {
        for (const label of labels) {
            if (label.bounds.left < bounds.left - 1)
                label.bounds = label.bounds.extend({
                    x: label.bounds.x + label.bounds.width,
                })
            else if (label.bounds.right > bounds.right + 1)
                label.bounds = label.bounds.extend({
                    x: label.bounds.x - label.bounds.width,
                })

            if (label.bounds.top < bounds.top - 1)
                label.bounds = label.bounds.extend({ y: bounds.top })
            else if (label.bounds.bottom > bounds.bottom + 1)
                label.bounds = label.bounds.extend({
                    y: bounds.bottom - label.bounds.height,
                })
        }
    }

    mouseFrame?: number
    @action.bound onMouseLeave() {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        if (this.props.onMouseLeave) this.props.onMouseLeave()
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        const nativeEvent = ev.nativeEvent

        this.mouseFrame = requestAnimationFrame(() => {
            const mouse = getRelativeMouse(this.base.current, nativeEvent)

            const closestSeries = minBy(this.renderData, (series) => {
                if (series.points.length > 1)
                    return min(
                        series.points.slice(0, -1).map((d, i) => {
                            return PointVector.distanceFromPointToLineSq(
                                mouse,
                                d.position,
                                series.points[i + 1].position
                            )
                        })
                    )

                return min(
                    series.points.map((v) =>
                        PointVector.distanceSq(v.position, mouse)
                    )
                )
            })

            if (closestSeries && this.props.onMouseOver) {
                const datum = this.seriesArray.find(
                    (d) => d.entityName === closestSeries.entityName
                )
                if (datum) this.props.onMouseOver(datum)
            }
        })
    }

    @action.bound onClick() {
        if (this.props.onClick) this.props.onClick()
    }

    @computed get backgroundGroups() {
        return this.renderData.filter((group) => !group.isForeground)
    }

    @computed get foregroundGroups() {
        return this.renderData.filter((group) => !!group.isForeground)
    }

    private renderBackgroundGroups() {
        const { backgroundGroups, isLayerMode, isConnected, hideLines } = this

        return hideLines
            ? []
            : backgroundGroups.map((group) => (
                  <ScatterBackgroundLine
                      key={group.entityName}
                      group={group}
                      isLayerMode={isLayerMode}
                      isConnected={isConnected}
                  />
              ))
    }

    private renderBackgroundLabels() {
        const { backgroundGroups, isLayerMode } = this

        return (
            <g
                className="backgroundLabels"
                fill={!isLayerMode ? "#333" : "#aaa"}
            >
                {backgroundGroups.map((series) => {
                    return series.allLabels
                        .filter((l) => !l.isHidden)
                        .map((l) =>
                            getElementWithHalo(
                                series.displayKey + "-endLabel",
                                <text
                                    x={l.bounds.x.toFixed(2)}
                                    y={(l.bounds.y + l.bounds.height).toFixed(
                                        2
                                    )}
                                    fontSize={l.fontSize.toFixed(2)}
                                    fontWeight={l.fontWeight}
                                    fill={isLayerMode ? "#aaa" : l.color}
                                >
                                    {l.text}
                                </text>
                            )
                        )
                })}
            </g>
        )
    }

    @computed get renderUid() {
        return guid()
    }

    private renderForegroundGroups() {
        const { foregroundGroups, isSubtleForeground, hideLines } = this

        return foregroundGroups.map((series) => {
            const lastValue = last(series.points) as ScatterRenderPoint
            const strokeWidth =
                (series.isHover ? 3 : isSubtleForeground ? 1.5 : 2) +
                lastValue.size * 0.05

            if (series.points.length === 1) {
                return (
                    <ScatterGroupSingle
                        key={series.displayKey}
                        group={series}
                    />
                )
            } else {
                const firstValue = first(series.points)
                const opacity = isSubtleForeground ? 0.9 : 1
                const radius = strokeWidth / 2 + 1
                let rotation = PointVector.angle(
                    series.offsetVector,
                    PointVector.up
                )
                if (series.offsetVector.x < 0) rotation = -rotation
                return (
                    <g key={series.displayKey} className={series.displayKey}>
                        <MultiColorPolyline
                            points={series.points.map((v) => ({
                                x: v.position.x,
                                y: v.position.y,
                                color: hideLines ? "rgba(0,0,0,0)" : v.color,
                            }))}
                            strokeWidth={strokeWidth}
                            opacity={opacity}
                        />
                        {series.isFocus && !hideLines && firstValue && (
                            <circle
                                cx={firstValue.position.x.toFixed(2)}
                                cy={firstValue.position.y.toFixed(2)}
                                r={radius}
                                fill={firstValue.color}
                                opacity={opacity}
                                stroke={firstValue.color}
                                strokeOpacity={0.6}
                            />
                        )}
                        {series.isHover &&
                            !hideLines &&
                            series.points
                                .slice(1, -1)
                                .map((v, index) => (
                                    <circle
                                        key={index}
                                        cx={v.position.x}
                                        cy={v.position.y}
                                        r={radius}
                                        fill={v.color}
                                        stroke="none"
                                    />
                                ))}
                        <Triangle
                            transform={`rotate(${rotation}, ${lastValue.position.x.toFixed(
                                2
                            )}, ${lastValue.position.y.toFixed(2)})`}
                            cx={lastValue.position.x}
                            cy={lastValue.position.y}
                            r={strokeWidth * 2}
                            fill={lastValue.color}
                            opacity={opacity}
                        />
                    </g>
                )
            }
        })
    }

    private renderForegroundLabels() {
        const { foregroundGroups } = this
        return foregroundGroups.map((series) => {
            return series.allLabels
                .filter((l) => !l.isHidden)
                .map((l, i) =>
                    getElementWithHalo(
                        `${series.displayKey}-label-${i}`,
                        <text
                            x={l.bounds.x.toFixed(2)}
                            y={(l.bounds.y + l.bounds.height).toFixed(2)}
                            fontSize={l.fontSize}
                            fontFamily={ScatterLabelFontFamily}
                            fontWeight={l.fontWeight}
                            fill={l.color}
                        >
                            {l.text}
                        </text>
                    )
                )
        })
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount() {
        const radiuses: string[] = []
        this.animSelection = select(this.base.current).selectAll("circle")

        this.animSelection
            .each(function () {
                const circle = this as SVGCircleElement
                radiuses.push(circle.getAttribute("r") as string)
                circle.setAttribute("r", "0")
            })
            .transition()
            .duration(500)
            .attr("r", (_, i) => radiuses[i])
            .on("end", () => this.forceUpdate())
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    render() {
        //Bounds.debug(flatten(map(this.renderData, d => map(d.labels, 'bounds'))))

        const { bounds, renderData, renderUid } = this
        const clipBounds = bounds.pad(-10)

        if (isEmpty(renderData))
            return (
                <NoDataModal
                    manager={this.props.noDataModalManager}
                    bounds={bounds}
                />
            )

        return (
            <g
                ref={this.base}
                className="PointsWithLabels clickable"
                clipPath={`url(#scatterBounds-${renderUid})`}
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
                onClick={this.onClick}
                fontFamily={ScatterLabelFontFamily}
            >
                <rect
                    key="background"
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.width}
                    height={bounds.height}
                    fill="rgba(255,255,255,0)"
                />
                <defs>
                    <clipPath id={`scatterBounds-${renderUid}`}>
                        <rect
                            x={clipBounds.x}
                            y={clipBounds.y}
                            width={clipBounds.width}
                            height={clipBounds.height}
                        />
                    </clipPath>
                </defs>
                {this.renderBackgroundGroups()}
                {this.renderBackgroundLabels()}
                {this.renderForegroundGroups()}
                {this.renderForegroundLabels()}
            </g>
        )
    }
}
