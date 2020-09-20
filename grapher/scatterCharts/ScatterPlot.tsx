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
    firstOfNonEmptyArray,
    lastOfNonEmptyArray,
    defaultTo,
    domainExtent,
    minBy,
    sortNumeric,
    lowerCaseFirstLetterUnlessAbbreviation,
    cagr,
    relativeMinAndMax,
    identity,
} from "grapher/utils/Util"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import {
    PointsWithLabels,
    ScatterSeries,
    ScatterValue,
} from "./PointsWithLabels"
import { TextWrap } from "grapher/text/TextWrap"
import {
    ConnectedScatterLegend,
    ConnectedScatterLegendOptionsProvider,
} from "./ConnectedScatterLegend"
import {
    VerticalColorLegend,
    VerticalColorLegendOptionsProvider,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import { ComparisonLine } from "./ComparisonLine"
import { EntityName } from "owidTable/OwidTableConstants"
import {
    AddCountryMode,
    BASE_FONT_SIZE,
    ScaleType,
    ScatterPointLabelStrategy,
    Time,
} from "grapher/core/GrapherConstants"
import { AbstractColumn } from "owidTable/OwidTable"
import { ColorScale } from "grapher/color/ColorScale"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { ChartInterface } from "grapher/chart/ChartInterface"

interface ScatterPlotOptionsProvider extends ChartOptionsProvider {
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    addCountryMode?: AddCountryMode
}

@observer
export class ScatterPlot
    extends React.Component<{
        bounds?: Bounds
        options: ScatterPlotOptionsProvider
    }>
    implements
        ConnectedScatterLegendOptionsProvider,
        ChartInterface,
        VerticalColorLegendOptionsProvider {
    // currently hovered individual series key
    @observable hoverKey?: EntityName
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get options() {
        return this.props.options
    }

    @computed.struct get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get canAddCountry() {
        const { addCountryMode } = this.options
        return addCountryMode && addCountryMode !== "disabled"
    }

    @action.bound onSelectEntity(entityName: EntityName) {
        if (this.canAddCountry) this.options.table.toggleSelection(entityName)
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
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { options, hoverColor } = this
        if (!this.canAddCountry || hoverColor === undefined) return

        const table = this.options.table
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
        return this.options.table.selectedEntityNames
    }

    @computed get displayStartTime() {
        return this.options.table.timeColumnFormatFunction(
            this.options.table.minTime ?? 1900
        )
    }

    @computed get displayEndTime() {
        return this.options.table.timeColumnFormatFunction(
            this.options.table.maxTime ?? 2000
        )
    }

    @computed get maxLegendWidth() {
        return this.sidebarWidth
    }

    @computed private get arrowLegend() {
        if (
            this.displayStartTime === this.displayEndTime ||
            this.options.isRelativeMode
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
        return this.options.comparisonLines
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
            flatten(series.map((s) => s.values.map((p) => p.color)))
        )
        return excludeUndefined(colorValues.map(this.colorScale.getColor))
    }

    @computed get hideLines() {
        return !!this.options.hideConnectedScatterLines
    }

    @computed private get scatterPointLabelFormatFunction() {
        const { options } = this
        const { yColumn, xColumn } = options

        const scatterPointLabelFormatFunctions = {
            year: (scatterValue: ScatterValue) =>
                this.options.table.timeColumnFormatFunction(scatterValue.year),
            y: (scatterValue: ScatterValue) =>
                yColumn!.formatValue(scatterValue.y),
            x: (scatterValue: ScatterValue) =>
                xColumn!.formatValue(scatterValue.x),
        }

        return scatterPointLabelFormatFunctions[
            this.options.scatterPointLabelStrategy || "year"
        ]
    }

    @computed private get points() {
        const { dualAxis, focusKeys, hoverKeys, hideLines, options } = this

        const { marks, sizeDomain, colorScale } = this

        return (
            <PointsWithLabels
                noDataOverlayOptionsProvider={options}
                hideLines={hideLines}
                data={marks}
                dualAxis={dualAxis}
                colorScale={this.options.colorColumn ? colorScale : undefined}
                sizeDomain={sizeDomain}
                focusKeys={focusKeys}
                hoverKeys={hoverKeys}
                onMouseOver={this.onScatterMouseOver}
                onMouseLeave={this.onScatterMouseLeave}
                onClick={this.onScatterClick}
                formatLabel={this.scatterPointLabelFormatFunction}
            />
        )
    }

    @computed get colorBins() {
        return this.colorScale.legendData.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get title() {
        return this.colorScale.legendDescription
    }

    @computed private get legendDimensions(): VerticalColorLegend {
        return new VerticalColorLegend({ options: this })
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataOverlay
                    options={this.options}
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
            options,
            legendDimensions,
        } = this

        return (
            <g className="ScatterPlot">
                <DualAxisComponent
                    isInteractive={options.isInteractive}
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
                <VerticalColorLegend options={this} />
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
                        yColumn={options.yColumn!}
                        xColumn={options.xColumn!}
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
        const that = this
        const colorColumn = this.options.colorColumn
        return new ColorScale({
            get config() {
                return that.options.colorScale!
            },
            defaultBaseColorScheme: "continents",
            defaultNoDataColor: "#959595",
            get categoricalValues() {
                return colorColumn?.sortedUniqNonEmptyStringVals ?? []
            },
            get hasNoDataBin() {
                return !!(
                    colorColumn &&
                    that.allPoints.some((point) => point.color === undefined)
                )
            },
        })
    }

    @computed get yAxis() {
        return this.options.yAxis ?? new AxisConfig()
    }

    @computed get xAxis() {
        return this.options.xAxis ?? new AxisConfig()
    }

    @computed private get yColumn() {
        return this.options.yColumn
    }

    @computed private get xColumn() {
        return this.options.yColumn
    }

    @computed private get sizeColumn() {
        return this.options.sizeColumn
    }

    @computed private get colorColumn() {
        return this.options.colorColumn
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
        return this.options.addCountryMode === "disabled"
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
            ? this.options.table.selectedEntityNames
            : this.possibleEntityNames

        if (this.options.matchingEntitiesOnly && this.options.colorColumn)
            entityNames = intersection(
                entityNames,
                this.options.colorColumn.entityNamesUniqArr
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
        return !!this.options.compareEndPointsOnly
    }

    set compareEndPointsOnly(value: boolean) {
        this.options.compareEndPointsOnly = value || undefined
    }

    @computed private get columns() {
        return [
            this.yColumn,
            this.xColumn,
            this.colorColumn,
            this.sizeColumn,
        ].filter(identity) as AbstractColumn[]
    }

    // todo: move this sort of thing to OwidTable
    // todo: add unit tests for this thing
    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    private getDataByEntityAndTime(
        entitiesToShow = this.getEntityNamesToShow()
    ): Map<EntityName, Map<Time, ScatterValue>> {
        const { columns } = this
        const validEntityLookup = keyBy(entitiesToShow)

        const dataByEntityAndTime = new Map<
            EntityName,
            Map<Time, ScatterValue>
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
        column: AbstractColumn,
        dataByEntityAndTime: Map<EntityName, Map<Time, ScatterValue>>,
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
                dataByYear = new Map<Time, ScatterValue>()
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
                    } as ScatterValue
                    dataByYear.set(outputYear, point)
                }

                ;(point as any).time[property] = year
                ;(point as any)[property] = value
            }
        })
    }

    @computed get propertyToColumnMap() {
        const map = new Map()
        map.set("x", this.xColumn)
        map.set("y", this.yColumn)
        map.set("size", this.sizeColumn)
        map.set("color", this.colorColumn)
        return map
    }

    @computed get columnToPropertyMap() {
        const map = new Map()
        map.set(this.xColumn, "x")
        map.set(this.yColumn, "y")
        map.set(this.sizeColumn, "size")
        map.set(this.colorColumn, "color")
        return map
    }

    private _removeUnwantedPoints(
        dataByEntityAndTime: Map<EntityName, Map<Time, ScatterValue>>
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
        const allPoints: ScatterValue[] = []
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
        return flatten(this.marks.map((g) => g.values))
    }

    // domains across the entire timeline
    private domainDefault(property: "x" | "y"): [number, number] {
        const scaleType = property === "x" ? this.xScaleType : this.yScaleType
        if (!this.options.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map((d) => d[property]),
                scaleType,
                this.options.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            )
        }

        if (this.options.isRelativeMode)
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
            !this.options.table.selectedEntityNames.length ||
            !this.options.zoomToSelection
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
        return this.options.isRelativeMode
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
        const { options, yDomainDefault } = this

        const axis = this.yAxis.toVerticalAxis()
        axis.column = this.yColumn

        const label = this.yAxisLabel

        axis.scaleType = this.yScaleType

        if (options.isRelativeMode) {
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
        return this.options.isRelativeMode
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
        const { xDomainDefault, options, xAxisLabelBase } = this

        const { xAxis } = this

        const axis = xAxis.toHorizontalAxis()
        axis.column = this.xColumn

        axis.scaleType = this.xScaleType
        if (options.isRelativeMode) {
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
        values: ScatterValue[],
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
            (vals: ScatterValue[]) =>
                minBy(vals, (v) =>
                    v.year === startTime || v.year === endTime
                        ? -Infinity
                        : Math.abs(v.year - v.time.y)
                ) as ScatterValue
        )

        if (xOverrideTime === undefined) {
            // NOTE: since groupBy() creates an object, the values may be reordered
            values = map(
                groupBy(values, (v) => v.time.x),
                (vals: ScatterValue[]) =>
                    minBy(vals, (v) =>
                        v.year === startTime || v.year === endTime
                            ? -Infinity
                            : Math.abs(v.year - v.time.x)
                    ) as ScatterValue
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

    // todo: refactor/remove and/or add unit tests
    @computed get marks() {
        const yColumn = this.options
        if (!yColumn) return []

        const {
            xScaleType,
            yScaleType,
            compareEndPointsOnly,
            xOverrideTime,
        } = this
        const { isRelativeMode, table } = this.options
        let currentData: ScatterSeries[] = []

        // As needed, join the individual year data points together to create an "arrow chart"
        this.getDataByEntityAndTime().forEach((dataByTime, entityName) => {
            const group = {
                entityName,
                label: entityName,
                color: "#932834", // Default color, used when no color dimension is present
                size: 0,
                values: [],
            } as ScatterSeries

            dataByTime.forEach((point) => {
                //  if (year < startTimelineTime || year > endTimelineTime) return
                group.values.push(point)
            })

            // Use most recent size and color values
            // const lastPoint = last(group.values)

            if (group.values.length) {
                const keyColor = table.getColorForEntityName(entityName)
                if (keyColor !== undefined) {
                    group.color = keyColor
                } else if (this.colorColumn) {
                    const colorValue = last(group.values.map((v) => v.color))
                    const color = this.colorScale.getColor(colorValue)
                    if (color !== undefined) {
                        group.color = color
                        group.isScaleColor = true
                    }
                }
                const sizes = group.values.map((v) => v.size)
                group.size = defaultTo(
                    last(sizes.filter((s) => isNumber(s))),
                    0
                )
                currentData.push(group)
            }
        })

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

        currentData = currentData.filter((series) => {
            // No point trying to render series with no valid points!
            if (series.values.length === 0) return false

            // // Hide lines which don't cover the full span
            // if (this.hideLinesOutsideTolerance)
            //     return (
            //         firstOfNonEmptyArray(series.values).year ===
            //             startTimelineTime &&
            //         lastOfNonEmptyArray(series.values).year === endTimelineTime
            //     )

            return true
        })

        if (compareEndPointsOnly) {
            currentData.forEach((series) => {
                const endPoints = [first(series.values), last(series.values)]
                series.values = compact(uniq(endPoints))
            })
        }

        if (isRelativeMode) {
            currentData.forEach((series) => {
                if (series.values.length === 0) return
                const startValue = firstOfNonEmptyArray(series.values)
                const endValue = lastOfNonEmptyArray(series.values)
                series.values = [
                    {
                        x: cagr(startValue, endValue, "x"),
                        y: cagr(startValue, endValue, "y"),
                        size: endValue.size,
                        year: endValue.year,
                        color: endValue.color,
                        time: {
                            y: endValue.time.y,
                            x: endValue.time.x,
                            span: [startValue.time.y, endValue.time.y],
                        },
                    },
                ]
            })
        }

        return currentData
    }
}

interface ScatterTooltipProps {
    yColumn: AbstractColumn
    xColumn: AbstractColumn
    series: ScatterSeries
    maxWidth: number
    fontSize: number
    x: number
    y: number
}

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValueY(value: ScatterValue) {
        return "Y Axis: " + this.props.yColumn.formatValue(value.y)
    }

    formatValueX(value: ScatterValue) {
        let s = `X Axis: ${this.props.xColumn.formatValue(value.x)}`
        if (!value.time.span && value.time.y !== value.time.x)
            s += ` (data from ${this.props.xColumn.formatTime(value.time.x)})`
        return s
    }

    render() {
        const { x, y, maxWidth, fontSize, series } = this.props
        const lineHeight = 5

        const firstValue = first(series.values)
        const lastValue = last(series.values)
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
                        ? `${yColumn.formatTime(
                              v.time.span[0]
                          )} to ${yColumn.formatTime(v.time.span[1])}`
                        : yColumn.formatTime(v.time.y),
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
