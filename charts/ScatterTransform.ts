import {
    some,
    isEmpty,
    intersection,
    keyBy,
    extend,
    isNumber,
    has,
    groupBy,
    sortBy,
    map,
    includes,
    sortedFindClosestIndex,
    firstOfNonEmptyArray,
    lastOfNonEmptyArray,
    uniq,
    compact,
    formatYear,
    flatten,
    defaultTo,
    first,
    last,
    formatValue,
    domainExtent,
    identity
} from "./Util"
import { computed } from "mobx"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { ScatterSeries, ScatterValue } from "./PointsWithLabels"
import { AxisSpec } from "./AxisSpec"
import { ChartTransform } from "./ChartTransform"
import { Time } from "./TimeBounds"
import { EntityDimensionKey } from "./EntityDimensionKey"
import { ColorScale } from "./ColorScale"
import { entityName, year } from "./owidData/OwidTable"
import { ScaleType } from "./ScaleType"

// Responsible for translating chart configuration into the form
// of a scatter plot
export class ScatterTransform extends ChartTransform {
    @computed get colorScale(): ColorScale {
        const that = this
        return new ColorScale({
            get config() {
                return that.chart.props.colorScale
            },
            get defaultBaseColorScheme() {
                return "continents"
            },
            get sortedNumericValues() {
                return that.colorDimension?.sortedNumericValues ?? []
            },
            get categoricalValues() {
                return that.colorDimension?.categoricalValues ?? []
            },
            get hasNoDataBin() {
                return that.allPoints.some(point => point.color === undefined)
            },
            get defaultNoDataColor() {
                return "#959595"
            },
            get formatNumericValue() {
                return that.colorDimension?.formatValueShort ?? identity
            }
        })
    }

    @computed get isValidConfig(): boolean {
        return (
            this.hasYDimension &&
            this.chart.dimensions.some(d => d.property === "x")
        )
    }

    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.chart
        if (!some(filledDimensions, d => d.property === "y"))
            return "Missing Y axis variable"
        else if (!some(filledDimensions, d => d.property === "x"))
            return "Missing X axis variable"
        else if (isEmpty(this.possibleEntityNames))
            return "No entities with data for both X and Y"
        else if (isEmpty(this.possibleDataYears))
            return "No years with data for both X and Y"
        else if (isEmpty(this.currentData)) return "No matching data"
        else return undefined
    }

    // Scatterplot should have exactly one dimension for each of x and y
    // The y dimension is treated as the "primary" variable
    @computed private get yDimension():
        | ChartDimensionWithOwidVariable
        | undefined {
        return this.chart.filledDimensions.find(d => d.property === "y")
    }
    @computed private get xDimension():
        | ChartDimensionWithOwidVariable
        | undefined {
        return this.chart.filledDimensions.find(d => d.property === "x")
    }
    @computed get colorDimension(): ChartDimensionWithOwidVariable | undefined {
        return this.chart.filledDimensions.find(d => d.property === "color")
    }

    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideYear(): number | undefined {
        return this.xDimension && this.xDimension.targetYear
    }

    set xOverrideYear(value: number | undefined) {
        ;(this
            .xDimension as ChartDimensionWithOwidVariable).props.targetYear = value
    }

    // In relative mode, the timeline scatterplot calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode(): boolean {
        return this.chart.props.stackMode === "relative"
    }

    @computed get canToggleRelative(): boolean {
        return (
            this.hasTimeline &&
            !this.chart.props.hideRelativeToggle &&
            this.xOverrideYear === undefined
        )
    }

    // Unlike other charts, the scatterplot shows all available data by default, and the selection
    // is just for emphasis. But this behavior can be disabled.
    @computed private get hideBackgroundEntities(): boolean {
        return this.chart.addCountryMode === "disabled"
    }
    @computed private get possibleEntityNames(): entityName[] {
        const yEntities = this.yDimension ? this.yDimension.entityNamesUniq : []
        const xEntities = this.xDimension ? this.xDimension.entityNamesUniq : []
        return intersection(yEntities, xEntities)
    }

    // todo: remove
    @computed get selectableEntityDimensionKeys(): EntityDimensionKey[] {
        return this.currentData.map(series => series.entityDimensionKey)
    }

    // todo: move to table
    @computed get excludedEntityNames(): entityName[] {
        const entityIds = this.chart.props.excludedEntities || []
        const entityNameMap = this.chart.table.entityIdToNameMap
        return entityIds
            .map(entityId => entityNameMap.get(entityId)!)
            .filter(d => d)
    }

    // todo: remove. do this at table filter level
    getEntityNamesToShow(
        filterBackgroundEntities = this.hideBackgroundEntities
    ): entityName[] {
        let entityNames = filterBackgroundEntities
            ? this.chart.data.selectedEntityNames
            : this.possibleEntityNames

        if (this.chart.props.matchingEntitiesOnly && this.colorDimension)
            entityNames = intersection(
                entityNames,
                this.colorDimension.entityNamesUniq
            )

        if (this.excludedEntityNames)
            entityNames = entityNames.filter(
                entity => !includes(this.excludedEntityNames, entity)
            )

        return entityNames
    }

    // The years for which there MAY be data on the scatterplot
    // Not all of these will necessarily end up on the timeline, because there may be no x/y entity overlap for that year
    // e.g. https://ourworldindata.org/grapher/life-expectancy-years-vs-real-gdp-per-capita-2011us
    @computed private get possibleDataYears(): number[] {
        const yDimensionYears = this.yDimension ? this.yDimension.yearsUniq : []
        const xDimensionYears = this.xDimension ? this.xDimension.yearsUniq : []

        if (this.xOverrideYear !== undefined) return yDimensionYears
        else return intersection(yDimensionYears, xDimensionYears)
    }

    // The years for which we intend to calculate output data
    @computed private get yearsToCalculate(): number[] {
        return this.possibleDataYears

        // XXX: Causes issues here https://ourworldindata.org/grapher/fish-consumption-vs-gdp-per-capita
        /*if (!this.chart.props.hideTimeline) {
            return this.possibleDataYears
        } else {
            // If there's no timeline, we only need to calculate data for the displayed range
            const minPossibleYear = this.possibleDataYears[0]
            const maxPossibleYear = this.possibleDataYears[this.possibleDataYears.length-1]
            const startYear = defaultTo(this.chart.timeDomain[0], minPossibleYear)
            const endYear = defaultTo(this.chart.timeDomain[1], maxPossibleYear)
            return this.possibleDataYears.filter(y => y >= startYear && y <= endYear)
        }*/
    }

    @computed get compareEndPointsOnly(): boolean {
        return !!this.chart.props.compareEndPointsOnly
    }

    set compareEndPointsOnly(value: boolean) {
        this.chart.props.compareEndPointsOnly = value || undefined
    }

    // todo: move this sort of thing to OwidTable
    // todo: add unit tests for this thing
    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    private getDataByEntityAndYear(
        entitiesToShow = this.getEntityNamesToShow()
    ): Map<entityName, Map<year, ScatterValue>> {
        const { chart } = this
        const { filledDimensions } = chart
        const validEntityLookup = keyBy(entitiesToShow)

        const dataByEntityAndYear = new Map<
            entityName,
            Map<year, ScatterValue>
        >()

        for (const dimension of filledDimensions) {
            // First, we organize the data by entity
            const initialDataByEntity = new Map<
                entityName,
                { years: year[]; values: (string | number)[] }
            >()
            const rows = dimension.column.rows
            dimension.values.forEach((value, index) => {
                const row = rows[index]
                const year = row.year ?? row.day
                const entityName = row.entityName

                if (!validEntityLookup[entityName]) return
                if (
                    (dimension.property === "x" ||
                        dimension.property === "y") &&
                    !isNumber(value)
                )
                    return

                let byEntity = initialDataByEntity.get(entityName)
                if (!byEntity) {
                    byEntity = { years: [], values: [] }
                    initialDataByEntity.set(entityName, byEntity)
                }

                byEntity.years.push(year)
                byEntity.values.push(value)
            })

            this._useTolerance(
                dimension,
                dataByEntityAndYear,
                initialDataByEntity
            )
        }

        this._removeUnwantedPoints(dataByEntityAndYear)

        return dataByEntityAndYear
    }

    private _useTolerance(
        dimension: ChartDimensionWithOwidVariable,
        dataByEntityAndYear: Map<entityName, Map<year, ScatterValue>>,
        initialDataByEntity: Map<
            entityName,
            { years: year[]; values: (string | number)[] }
        >
    ) {
        const { yearsToCalculate, xOverrideYear } = this
        const tolerance =
            dimension.property === "size" ? Infinity : dimension.tolerance

        // Now go through each entity + timeline year and use a binary search to find the closest
        // matching data year within tolerance
        // NOTE: this code assumes years is sorted asc!!!
        initialDataByEntity.forEach((byEntity, entityName) => {
            let dataByYear = dataByEntityAndYear.get(entityName)
            if (dataByYear === undefined) {
                dataByYear = new Map<year, ScatterValue>()
                dataByEntityAndYear.set(entityName, dataByYear)
            }

            for (const outputYear of yearsToCalculate) {
                const targetYear =
                    xOverrideYear !== undefined && dimension.property === "x"
                        ? xOverrideYear
                        : outputYear
                const i = sortedFindClosestIndex(byEntity.years, targetYear)
                const year = byEntity.years[i]

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
                        time: {}
                    } as ScatterValue
                    dataByYear.set(outputYear, point)
                }

                ;(point as any).time[dimension.property] = year
                ;(point as any)[dimension.property] = value
            }
        })
    }

    private _removeUnwantedPoints(
        dataByEntityAndYear: Map<entityName, Map<year, ScatterValue>>
    ) {
        // The exclusion of points happens as a last step in order to avoid artefacts due to
        // the tolerance calculation. E.g. if we pre-filter the data based on the X and Y
        // domains before creating the points, the tolerance may lead to different X-Y
        // values being joined.
        // -@danielgavrilov, 2020-04-29
        const chart = this.chart
        dataByEntityAndYear.forEach(dataByYear => {
            dataByYear.forEach((point, year) => {
                // Exclude any points with data for only one axis
                if (!has(point, "x") || !has(point, "y")) {
                    dataByYear.delete(year)
                }
                // Exclude points that go beyond min/max of X axis
                else if (
                    (chart.xAxis.removePointsOutsideDomain &&
                        chart.xAxis.min !== undefined &&
                        point.x < chart.xAxis.min) ||
                    (chart.xAxis.removePointsOutsideDomain &&
                        chart.xAxis.max !== undefined &&
                        point.x > chart.xAxis.max)
                ) {
                    dataByYear.delete(year)
                }
                // Exclude points that go beyond min/max of Y axis
                else if (
                    (chart.yAxis.removePointsOutsideDomain &&
                        chart.yAxis.min !== undefined &&
                        point.y < chart.yAxis.min) ||
                    (chart.yAxis.removePointsOutsideDomain &&
                        chart.yAxis.max !== undefined &&
                        point.y > chart.yAxis.max)
                ) {
                    dataByYear.delete(year)
                }
            })
        })
    }

    @computed get allPoints(): ScatterValue[] {
        const allPoints: ScatterValue[] = []
        this.getDataByEntityAndYear().forEach(dataByYear => {
            dataByYear.forEach(point => {
                allPoints.push(point)
            })
        })
        return allPoints
    }

    // The selectable years that will end up on the timeline UI (if enabled)
    @computed get availableYears(): Time[] {
        return this.allPoints.map(point => point.year)
    }

    @computed private get currentValues(): ScatterValue[] {
        return flatten(this.currentData.map(g => g.values))
    }

    private relativeMinAndMax(property: "x" | "y"): [number, number] {
        let minChange = 0
        let maxChange = 0

        const values = this.allPoints.filter(
            point => point.x !== 0 && point.y !== 0
        )
        for (let i = 0; i < values.length; i++) {
            const indexValue = values[i]
            for (let j = i; j < values.length; j++) {
                const targetValue = values[j]
                const change = cagr(indexValue, targetValue, property)
                if (change < minChange) minChange = change
                if (change > maxChange) maxChange = change
            }
        }
        return [minChange, maxChange]
    }

    // domains across the entire timeline
    @computed private get xDomainDefault(): [number, number] {
        if (!this.chart.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map(d => d.x),
                this.xScaleType,
                this.chart.props.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            )
        }

        if (this.isRelativeMode) return this.relativeMinAndMax("x")

        return domainExtent(
            this.allPoints.map(v => v.x),
            this.xScaleType
        )
    }

    @computed private get yDomainDefault(): [number, number] {
        if (!this.chart.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map(d => d.y),
                this.yScaleType,
                this.chart.props.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            )
        }

        if (this.isRelativeMode) return this.relativeMinAndMax("y")

        return domainExtent(
            this.allPoints.map(v => v.y),
            this.yScaleType
        )
    }

    @computed private get selectedPoints() {
        const entitiesFor = new Set(this.getEntityNamesToShow(true))
        return this.allPoints.filter(
            point => point.entityName && entitiesFor.has(point.entityName)
        )
    }

    @computed private get pointsForAxisDomains() {
        if (!this.chart.data.hasSelection || !this.chart.props.zoomToSelection)
            return this.currentValues

        return this.selectedPoints.length
            ? this.selectedPoints
            : this.currentValues
    }

    @computed get sizeDomain(): [number, number] {
        const sizeValues: number[] = []
        this.allPoints.forEach(g => g.size && sizeValues.push(g.size))
        if (sizeValues.length === 0) return [1, 100]
        else return domainExtent(sizeValues, "linear")
    }

    @computed private get yScaleType() {
        return this.isRelativeMode ? "linear" : this.chart.yAxis.scaleType
    }

    @computed private get yAxisLabelBase(): string | undefined {
        return this.yDimension && this.yDimension.displayName
    }

    @computed get yAxis(): AxisSpec {
        const {
            chart,
            yDomainDefault,
            yDimension,
            isRelativeMode,
            yScaleType,
            yAxisLabelBase
        } = this

        const props: Partial<AxisSpec> = {}
        props.scaleType = yScaleType
        const label = chart.yAxis.label ?? yAxisLabelBase
        if (isRelativeMode) {
            props.domain = yDomainDefault
            props.scaleTypeOptions = ["linear"]
            if (label && label.length > 1) {
                props.label =
                    "Average annual change in " +
                    (label.charAt(1).match(/[A-Z]/)
                        ? label
                        : label.charAt(0).toLowerCase() + label.slice(1))
            }
            props.tickFormat = (v: number) => formatValue(v, { unit: "%" })
        } else {
            props.label = label
            props.tickFormat = yDimension && yDimension.formatValueShort
        }

        return extend(
            chart.yAxis.toSpec({ defaultDomain: yDomainDefault }),
            props
        ) as AxisSpec
    }

    @computed private get xScaleType(): "linear" | "log" {
        return this.isRelativeMode ? "linear" : this.chart.xAxis.scaleType
    }

    @computed private get xAxisLabelBase(): string | undefined {
        const xDimName = this.xDimension && this.xDimension.displayName
        if (this.xOverrideYear !== undefined)
            return `${xDimName} in ${this.xOverrideYear}`
        else return xDimName
    }

    @computed get xAxis(): AxisSpec {
        const {
            chart,
            xDomainDefault,
            xDimension,
            isRelativeMode,
            xScaleType,
            xAxisLabelBase
        } = this

        const props: Partial<AxisSpec> = {}
        props.scaleType = xScaleType
        if (isRelativeMode) {
            props.domain = xDomainDefault
            props.scaleTypeOptions = ["linear"]
            const label = chart.xAxis.label || xAxisLabelBase
            if (label && label.length > 1) {
                props.label =
                    "Average annual change in " +
                    (label.charAt(1).match(/[A-Z]/)
                        ? label
                        : label.charAt(0).toLowerCase() + label.slice(1))
            }
            props.tickFormat = (v: number) => formatValue(v, { unit: "%" })
        } else {
            props.label = chart.xAxis.label || xAxisLabelBase
            props.tickFormat = xDimension && xDimension.formatValueShort
        }

        return extend(
            chart.xAxis.toSpec({ defaultDomain: xDomainDefault }),
            props
        ) as AxisSpec
    }

    @computed get yFormatTooltip(): (d: number) => string {
        return this.isRelativeMode || !this.yDimension
            ? this.yAxis.tickFormat
            : this.yDimension.formatValueLong
    }

    @computed get xFormatTooltip(): (d: number) => string {
        return this.isRelativeMode || !this.xDimension
            ? this.xAxis.tickFormat
            : this.xDimension.formatValueLong
    }

    @computed get yFormatYear(): (year: number) => string {
        return this.yDimension ? this.yDimension.formatYear : formatYear
    }

    @computed get xFormatYear(): (year: number) => string {
        return this.xDimension ? this.xDimension.formatYear : formatYear
    }

    // todo: add unit tests
    private _filterValues(
        values: ScatterValue[],
        startYear: year,
        endYear: year,
        yScaleType: ScaleType,
        xScaleType: ScaleType,
        isRelativeMode: boolean,
        xOverrideYear?: year
    ) {
        // Only allow tolerance data to occur once in any given chart (no duplicate data points)
        // Prioritize the start and end years first, then the "true" year

        // NOTE: since groupBy() creates an object, the values may be reordered. we reorder a few lines below.
        values = map(
            groupBy(values, v => v.time.y),
            (vals: ScatterValue[]) =>
                sortBy(vals, v =>
                    v.year === startYear || v.year === endYear
                        ? -Infinity
                        : Math.abs(v.year - v.time.y)
                )[0]
        )

        if (xOverrideYear === undefined) {
            // NOTE: since groupBy() creates an object, the values may be reordered
            values = map(
                groupBy(values, v => v.time.x),
                (vals: ScatterValue[]) =>
                    sortBy(vals, v =>
                        v.year === startYear || v.year === endYear
                            ? -Infinity
                            : Math.abs(v.year - v.time.x)
                    )[0]
            )
        }

        // Sort values by year again in case groupBy() above reordered the values
        values = sortBy(values, v => v.year)

        // Don't allow values <= 0 for log scales
        if (yScaleType === "log") values = values.filter(v => v.y > 0)
        if (xScaleType === "log") values = values.filter(v => v.x > 0)

        // Don't allow values *equal* to zero for CAGR mode
        if (isRelativeMode) values = values.filter(v => v.y !== 0 && v.x !== 0)

        return values
    }

    // todo: refactor/remove and/or add unit tests
    @computed get currentData(): ScatterSeries[] {
        if (!this.chart.isReady) return []

        const {
            chart,
            startYear,
            endYear,
            xScaleType,
            yScaleType,
            isRelativeMode,
            compareEndPointsOnly,
            xOverrideYear
        } = this
        const { keyColors } = chart.data
        let currentData: ScatterSeries[] = []

        // As needed, join the individual year data points together to create an "arrow chart"
        this.getDataByEntityAndYear().forEach((dataByYear, entityName) => {
            // Since scatterplots interrelate two variables via entity overlap, their entityDimensionKeys are solely entity-based
            const entityDimensionKey = chart.data.makeEntityDimensionKey(
                entityName,
                0
            )

            const group = {
                entityDimensionKey,
                label: chart.data.getLabelForKey(entityDimensionKey),
                color: "#932834", // Default color, used when no color dimension is present
                size: 0,
                values: []
            } as ScatterSeries

            dataByYear.forEach((point, year) => {
                if (year < startYear || year > endYear) return
                group.values.push(point)
            })

            // Use most recent size and color values
            // const lastPoint = last(group.values)

            if (group.values.length) {
                const keyColor = keyColors[entityDimensionKey]
                if (keyColor !== undefined) {
                    group.color = keyColor
                } else if (this.colorDimension) {
                    const colorValue = last(group.values.map(v => v.color))
                    const color = this.colorScale.getColor(colorValue)
                    if (color !== undefined) {
                        group.color = color
                        group.isScaleColor = true
                    }
                }
                const sizes = group.values.map(v => v.size)
                group.size = defaultTo(last(sizes.filter(s => isNumber(s))), 0)
                currentData.push(group)
            }
        })

        currentData.forEach(series => {
            series.values = this._filterValues(
                series.values,
                startYear,
                endYear,
                yScaleType,
                xScaleType,
                isRelativeMode,
                xOverrideYear
            )
        })

        currentData = currentData.filter(series => {
            // No point trying to render series with no valid points!
            if (series.values.length === 0) return false

            // Hide lines which don't cover the full span
            if (this.chart.props.hideLinesOutsideTolerance)
                return (
                    firstOfNonEmptyArray(series.values).year === startYear &&
                    lastOfNonEmptyArray(series.values).year === endYear
                )

            return true
        })

        if (compareEndPointsOnly) {
            currentData.forEach(series => {
                const endPoints = [first(series.values), last(series.values)]
                series.values = compact(uniq(endPoints))
            })
        }

        if (isRelativeMode) {
            currentData.forEach(series => {
                if (series.values.length === 0) return
                const indexValue = firstOfNonEmptyArray(series.values)
                const targetValue = lastOfNonEmptyArray(series.values)
                series.values = [
                    {
                        x: cagr(indexValue, targetValue, "x"),
                        y: cagr(indexValue, targetValue, "y"),
                        size: targetValue.size,
                        year: targetValue.year,
                        time: {
                            y: targetValue.time.y,
                            x: targetValue.time.x,
                            span: [indexValue.time.y, targetValue.time.y]
                        }
                    }
                ]
            })
        }

        return currentData
    }
}

function cagr(
    indexValue: ScatterValue,
    targetValue: ScatterValue,
    property: "x" | "y"
) {
    if (targetValue.year - indexValue.year === 0) return 0
    else {
        const frac = targetValue[property] / indexValue[property]
        if (frac < 0)
            return (
                -(
                    Math.pow(-frac, 1 / (targetValue.year - indexValue.year)) -
                    1
                ) * 100
            )
        else
            return (
                (Math.pow(frac, 1 / (targetValue.year - indexValue.year)) - 1) *
                100
            )
    }
}
