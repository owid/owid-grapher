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
    flatten
} from "./Util"
import { computed } from "mobx"
import { defaultTo, first, last } from "./Util"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { ScatterSeries, ScatterValue } from "./PointsWithLabels"
import { AxisSpec } from "./AxisSpec"
import { formatValue, domainExtent } from "./Util"
import { ChartTransform } from "./ChartTransform"
import { Colorizer, Colorable } from "./Colorizer"
import { Time } from "./TimeBounds"
import { EntityDimensionKey } from "./EntityDimensionKey"

// Responsible for translating chart configuration into the form
// of a scatter plot
export class ScatterTransform extends ChartTransform {
    @computed get colorKeys(): string[] {
        const { colorDimension } = this
        return colorDimension ? colorDimension.variable.categoricalValues : []
    }

    @computed get colors(): Colorizer {
        const that = this
        return new Colorizer({
            get chart() {
                return that.chart
            },
            get defaultColorScheme() {
                return "continents"
            },
            get keys() {
                return that.colorKeys
            }
        })
    }

    @computed get colorables(): Colorable[] {
        return this.colors.colorables
    }

    @computed get isValidConfig(): boolean {
        return (
            this.chart.dimensions.some(d => d.property === "y") &&
            this.chart.dimensions.some(d => d.property === "x")
        )
    }

    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.chart.data
        if (!some(filledDimensions, d => d.property === "y"))
            return "Missing Y axis variable"
        else if (!some(filledDimensions, d => d.property === "x"))
            return "Missing X axis variable"
        else if (isEmpty(this.possibleEntities))
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
        return this.chart.data.filledDimensions.find(d => d.property === "y")
    }
    @computed private get xDimension():
        | ChartDimensionWithOwidVariable
        | undefined {
        return this.chart.data.filledDimensions.find(d => d.property === "x")
    }
    @computed private get colorDimension():
        | ChartDimensionWithOwidVariable
        | undefined {
        return this.chart.data.filledDimensions.find(
            d => d.property === "color"
        )
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
    @computed private get possibleEntities(): string[] {
        const yEntities = this.yDimension
            ? this.yDimension.variable.entitiesUniq
            : []
        const xEntities = this.xDimension
            ? this.xDimension.variable.entitiesUniq
            : []
        return intersection(yEntities, xEntities)
    }

    @computed get selectableEntityDimensionKeys(): EntityDimensionKey[] {
        return this.currentData.map(series => series.entityDimensionKey)
    }

    @computed get excludedEntities(): string[] {
        const entityIds = this.chart.props.excludedEntities || []
        return entityIds
            .map(id => {
                const meta = this.chart.entityMetaById[id]
                return meta && meta.name
            })
            .filter(d => d)
    }

    getEntitiesToShow(
        filterBackgroundEntities = this.hideBackgroundEntities
    ): string[] {
        let entities = filterBackgroundEntities
            ? this.chart.data.selectedEntities
            : this.possibleEntities

        if (this.chart.props.matchingEntitiesOnly && this.colorDimension)
            entities = intersection(
                entities,
                this.colorDimension.variable.entitiesUniq
            )

        if (this.excludedEntities)
            entities = entities.filter(
                entity => !includes(this.excludedEntities, entity)
            )

        return entities
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

    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    private getDataByEntityAndYear(
        entitiesToShow = this.getEntitiesToShow()
    ): Map<string, Map<number, ScatterValue>> {
        const { chart, yearsToCalculate, colors, xOverrideYear } = this
        const { filledDimensions } = chart.data
        const validEntityLookup = keyBy(entitiesToShow)

        const dataByEntityAndYear = new Map<string, Map<number, ScatterValue>>()

        for (const dimension of filledDimensions) {
            const tolerance =
                dimension.property === "color" || dimension.property === "size"
                    ? Infinity
                    : dimension.tolerance

            // First, we organize the data by entity
            const initialDataByEntity = new Map<
                string,
                { years: number[]; values: (string | number)[] }
            >()
            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const value = dimension.values[i]
                const entity = dimension.entityNames[i]

                if (!validEntityLookup[entity]) continue

                if (
                    (dimension.property === "x" ||
                        dimension.property === "y") &&
                    !isNumber(value)
                )
                    continue

                let byEntity = initialDataByEntity.get(entity)
                if (!byEntity) {
                    byEntity = { years: [], values: [] }
                    initialDataByEntity.set(entity, byEntity)
                }

                byEntity.years.push(year)
                byEntity.values.push(value)
            }

            // Now go through each entity + timeline year and use a binary search to find the closest
            // matching data year within tolerance
            initialDataByEntity.forEach((byEntity, entity) => {
                let dataByYear = dataByEntityAndYear.get(entity)
                if (dataByYear === undefined) {
                    dataByYear = new Map()
                    dataByEntityAndYear.set(entity, dataByYear)
                }

                for (const outputYear of yearsToCalculate) {
                    const targetYear =
                        xOverrideYear !== undefined &&
                        dimension.property === "x"
                            ? xOverrideYear
                            : outputYear
                    const i = sortedFindClosestIndex(byEntity.years, targetYear)
                    const year = byEntity.years[i]

                    // Skip years that aren't within tolerance of the target
                    if (
                        year < targetYear - tolerance ||
                        year > targetYear + tolerance
                    )
                        continue

                    const value = byEntity.values[i]

                    let point = dataByYear.get(outputYear)
                    if (point === undefined) {
                        point = {
                            year: outputYear,
                            time: {}
                        } as ScatterValue
                        dataByYear.set(outputYear, point)
                    }

                    ;(point.time as any)[dimension.property] = year
                    if (dimension.property === "color") {
                        point.color = colors.get(value as string)
                    } else {
                        ;(point as any)[dimension.property] = value
                    }
                }
            })
        }

        dataByEntityAndYear.forEach((dataByYear, entity) => {
            dataByYear.forEach((point, year) => {
                // The exclusion of points happens as a last step in order to avoid artefacts due to
                // the tolerance calculation. E.g. if we pre-filter the data based on the X and Y
                // domains before creating the points, the tolerance may lead to different X-Y
                // values being joined.
                // -@danielgavrilov, 2020-04-29
                if (
                    // Exclude any points with data for only one axis
                    !has(point, "x") ||
                    !has(point, "y") ||
                    // Exclude points that go beyond min/max of X axis
                    (chart.xAxis.removePointsOutsideDomain &&
                        chart.xAxis.min !== undefined &&
                        point.x < chart.xAxis.min) ||
                    (chart.xAxis.removePointsOutsideDomain &&
                        chart.xAxis.max !== undefined &&
                        point.x > chart.xAxis.max) ||
                    // Exclude points that go beyond min/max of Y axis
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

        return dataByEntityAndYear
    }

    @computed private get allPoints(): ScatterValue[] {
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

    // domains across the entire timeline
    @computed private get xDomainDefault(): [number, number] {
        if (!this.chart.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map(d => d.x),
                this.xScaleType,
                this.chart.props.zoomToSelection ? 1.1 : 1
            )
        }

        if (this.isRelativeMode) {
            let minChange = 0
            let maxChange = 0
            this.getDataByEntityAndYear().forEach(dataByYear => {
                const values = Array.from(dataByYear.values()).filter(
                    v => v.x !== 0 && v.y !== 0
                )
                for (let i = 0; i < values.length; i++) {
                    const indexValue = values[i]
                    for (let j = i; j < values.length; j++) {
                        const targetValue = values[j]
                        const change = cagrX(indexValue, targetValue)
                        if (change < minChange) minChange = change
                        if (change > maxChange) maxChange = change
                    }
                }
            })
            return [minChange, maxChange]
        } else {
            return domainExtent(
                this.allPoints.map(v => v.x),
                this.xScaleType
            )
        }
    }

    @computed private get yDomainDefault(): [number, number] {
        if (!this.chart.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map(d => d.y),
                this.yScaleType,
                this.chart.props.zoomToSelection ? 1.1 : 1
            )
        }

        if (this.isRelativeMode) {
            let minChange = 0
            let maxChange = 0
            this.getDataByEntityAndYear().forEach(dataByYear => {
                const values = Array.from(dataByYear.values()).filter(
                    v => v.x !== 0 && v.y !== 0
                )
                for (let i = 0; i < values.length; i++) {
                    const indexValue = values[i]
                    for (let j = i; j < values.length; j++) {
                        const targetValue = values[j]
                        const change = cagrY(indexValue, targetValue)
                        if (change < minChange) minChange = change
                        if (change > maxChange) maxChange = change
                    }
                }
            })
            return [minChange, maxChange]
        } else {
            return domainExtent(
                this.allPoints.map(v => v.y),
                this.yScaleType
            )
        }
    }

    @computed private get pointsForAxisDomains() {
        if (!this.chart.data.hasSelection || !this.chart.props.zoomToSelection)
            return this.currentValues
        const allPoints: ScatterValue[] = []
        this.getDataByEntityAndYear(this.getEntitiesToShow(true)).forEach(
            dataByYear => {
                dataByYear.forEach(point => {
                    allPoints.push(point)
                })
            }
        )
        return allPoints
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
        if (isRelativeMode) {
            props.domain = yDomainDefault
            props.scaleTypeOptions = ["linear"]
            const label = chart.yAxis.label || yAxisLabelBase
            if (label && label.length > 1) {
                props.label =
                    "Average annual change in " +
                    (label.charAt(1).match(/[A-Z]/)
                        ? label
                        : label.charAt(0).toLowerCase() + label.slice(1))
            }
            props.tickFormat = (v: number) => formatValue(v, { unit: "%" })
        } else {
            props.label = chart.yAxis.label || yAxisLabelBase
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

    @computed get currentData(): ScatterSeries[] {
        if (!this.chart.data.isReady) return []

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
        this.getDataByEntityAndYear().forEach((dataByYear, entity) => {
            // Since scatterplots interrelate two variables via entity overlap, their entityDimensionKeys are solely entity-based
            const entityDimensionKey = chart.data.makeEntityDimensionKey(
                entity,
                0
            )

            const group = {
                entityDimensionKey,
                label: chart.data.getLabelForKey(entityDimensionKey),
                color: "#ffcb1f", // Default color
                size: 0,
                values: []
            } as ScatterSeries

            dataByYear.forEach((point, year) => {
                if (year < startYear || year > endYear) return

                group.values.push(point)
            })

            // Use most recent size and color values
            // const lastPoint = last(group.values)

            if (group && group.values.length) {
                const keyColor = keyColors[entityDimensionKey]
                if (keyColor !== undefined) {
                    group.color = keyColor
                } else {
                    const color = last(
                        group.values.map(v => v.color).filter(s => s)
                    )
                    if (color !== undefined) {
                        group.color = color
                        group.isAutoColor = true
                    }
                }
                const sizes = group.values.map(v => v.size)
                group.size = defaultTo(last(sizes.filter(s => isNumber(s))), 0)
                currentData.push(group)
            }
        })

        currentData = currentData.map(series => {
            // Only allow tolerance data to occur once in any given chart (no duplicate data points)
            // Prioritize the start and end years first, then the "true" year
            let values = series.values

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

            // Don't allow values <= 0 for log scales
            if (yScaleType === "log") values = values.filter(v => v.y > 0)
            if (xScaleType === "log") values = values.filter(v => v.x > 0)

            // Don't allow values *equal* to zero for CAGR mode
            if (isRelativeMode)
                values = values.filter(v => v.y !== 0 && v.x !== 0)

            return extend({}, series, {
                values: values
            })
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
                        x: cagrX(indexValue, targetValue),
                        y: cagrY(indexValue, targetValue),
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

function cagrX(indexValue: ScatterValue, targetValue: ScatterValue) {
    if (targetValue.year - indexValue.year === 0) return 0
    else {
        const frac = targetValue.x / indexValue.x
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

function cagrY(indexValue: ScatterValue, targetValue: ScatterValue) {
    if (targetValue.year - indexValue.year === 0) return 0
    else {
        const frac = targetValue.y / indexValue.y
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
