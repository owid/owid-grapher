import {scaleOrdinal} from 'd3-scale'
import ChartConfig from './ChartConfig'
import {some, isEmpty, find, intersection, min, max, keyBy, extend, isNumber, has, uniq, groupBy, sortBy, map, includes} from './Util'
import {computed, observable} from 'mobx'
import {defaultTo, first, last} from './Util'
import DimensionWithData from './DimensionWithData'
import {ScatterSeries, ScatterValue} from './PointsWithLabels'
import AxisSpec from './AxisSpec'
import {formatValue, domainExtent, findClosest} from './Util'
import ColorSchemes from './ColorSchemes'
import IChartTransform from './IChartTransform'

// Responsible for translating chart configuration into the form
// of a scatter plot
export default class ScatterTransform implements IChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) { 
        this.chart = chart
    }

    @observable.ref useTimelineDomains = false

    @computed get isValidConfig(): boolean {
        return some(this.chart.dimensions, d => d.property == 'y') && some(this.chart.dimensions, d => d.property == 'x')
    }

    @computed get failMessage(): string|undefined {
        const {filledDimensions} = this.chart.data
        if (!some(filledDimensions, d => d.property == 'y'))
            return "Missing Y axis variable"
        else if (!some(filledDimensions, d => d.property == 'x'))
            return "Missing X axis variable"
        else if (isEmpty(this.possibleEntities))
            return "No entities with data for both X and Y"
        else if (isEmpty(this.timelineYears))
            return "No years with data for both X and Y"
        else if (isEmpty(this.currentData))
            return "No matching data"
        else
            return undefined
    }

    // Scatterplot should have exactly one dimension for each of x and y
    // The y dimension is treated as the "primary" variable
    @computed get yDimension(): DimensionWithData|undefined {
        return find(this.chart.data.filledDimensions, d => d.property == 'y')
    }
    @computed get xDimension(): DimensionWithData|undefined {
        return find(this.chart.data.filledDimensions, d => d.property == 'x')
    }
    @computed get colorDimension(): DimensionWithData|undefined {
        return find(this.chart.data.filledDimensions, d => d.property == 'color')
    }
    @computed get axisDimensions(): DimensionWithData[] {
        let dimensions = []
        if (this.yDimension) dimensions.push(this.yDimension)
        if (this.xDimension) dimensions.push(this.xDimension)
        return dimensions
    }

    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideYear(): number|undefined {
        return this.xDimension && this.xDimension.targetYear
    }

    set xOverrideYear(value: number|undefined) {
        (this.xDimension as DimensionWithData).props.targetYear = value
    }

    // In relative mode, the timeline scatterplot calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode(): boolean {
		return this.chart.props.stackMode == 'relative'
    }

    @computed get canToggleRelative(): boolean {
        return this.hasTimeline && !this.chart.props.hideRelativeToggle && this.xOverrideYear == null
    }

    // Unlike other charts, the scatterplot shows all available data by default, and the selection
    // is just for emphasis. But this behavior can be disabled.
    @computed get hideBackgroundEntities(): boolean {
        return this.chart.addCountryMode == 'disabled'
    }
    @computed get possibleEntities(): string[] {
        const yEntities = this.yDimension ? this.yDimension.variable.entitiesUniq : []
        const xEntities = this.xDimension ? this.xDimension.variable.entitiesUniq : []
        return intersection(yEntities, xEntities)
    }

    @computed get excludedEntities(): string[] {
        const entityIds = this.chart.props.excludedEntities||[]
        return entityIds.map(id => {
            const meta = this.chart.vardata.entityMetaById[id]
            return meta && meta.name
        }).filter(d => d)
    }

    @computed get entitiesToShow(): string[] {
        let entities = this.hideBackgroundEntities ? this.chart.data.selectedEntities : this.possibleEntities

        if (this.chart.props.matchingEntitiesOnly && this.colorDimension)
            entities = intersection(entities, this.colorDimension.variable.entitiesUniq)

        if (this.excludedEntities)
            entities = entities.filter(entity => !includes(this.excludedEntities, entity))

        return entities
    }

    @computed get timelineYears(): number[] {
        const yDimensionYears = this.yDimension ? this.yDimension.variable.yearsUniq : []
        const xDimensionYears = this.xDimension ? this.xDimension.variable.yearsUniq : []

        if (this.xOverrideYear != null)
            return yDimensionYears
        else
            return intersection(yDimensionYears, xDimensionYears)
    }

    @computed get minTimelineYear(): number {
        return defaultTo(min(this.timelineYears), 1900)
    }

    @computed get maxTimelineYear(): number {
        return defaultTo(max(this.timelineYears), 2000)
    }

    @computed get hasTimeline(): boolean {
        return this.minTimelineYear != this.maxTimelineYear && !this.chart.props.hideTimeline
    }

    @computed get startYear(): number {
        const minYear = this.chart.timeDomain[0]

        if (minYear != null)
            return defaultTo(findClosest(this.timelineYears, minYear), this.minTimelineYear)
        else
            return this.maxTimelineYear
    }

    @computed get endYear(): number {
        const maxYear = this.chart.timeDomain[1]

        if (maxYear != null)
            return defaultTo(findClosest(this.timelineYears, maxYear), this.maxTimelineYear)
        else
            return this.maxTimelineYear
    }

    @computed get compareEndPointsOnly(): boolean {
        return !!this.chart.props.compareEndPointsOnly
    }

    set compareEndPointsOnly(value: boolean) {
        this.chart.props.compareEndPointsOnly = value||undefined
    }

    @computed.struct get yearsToCalculate(): number[] {
        if (this.hasTimeline) {
            return this.timelineYears
        } else {
            return this.timelineYears.filter(y => y >= this.startYear && y <= this.endYear)
        }
    }

    @computed get defaultColors(): string[] {
        return [ // default color scheme for continents
            "#5675c1", // Africa
            "#aec7e8", // Antarctica
            "#d14e5b", // Asia
            "#ffd336", // Europe
            "#4d824b", // North America
            "#a652ba", // Oceania
            "#69c487", // South America
            "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]
    }

    @computed get colorScheme(): string[] {
        const {baseColorScheme} = this.chart
        const {colorDimension} = this

        const colorScheme = baseColorScheme && ColorSchemes[baseColorScheme]
        if (!colorScheme) return this.defaultColors
        else if (!colorDimension) return colorScheme.getColors(4)
        else return colorScheme.getColors(colorDimension.variable.categoricalValues.length)
    }

    @computed get colorScale(): d3.ScaleOrdinal<string, string> {
        const colorDim = this.chart.data.dimensionsByField['color']

        const colorScale = scaleOrdinal(this.colorScheme)
        if (colorDim) {
            colorScale.domain(colorDim.variable.categoricalValues);
        }

        return colorScale
    }

    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    @computed get dataByEntityAndYear(): Map<string, Map<number, ScatterSeries>> {
        const {chart, yearsToCalculate, colorScale, entitiesToShow, xOverrideYear} = this
        const {filledDimensions, keyColors} = chart.data
        const validEntityLookup = keyBy(entitiesToShow)
        
        let dataByEntityAndYear = new Map<string, Map<number, ScatterSeries>>()

        // The data values
        filledDimensions.forEach(dimension => {
            var tolerance = (dimension.property == 'color' || dimension.property == 'size') ? Infinity : dimension.tolerance;

            yearsToCalculate.forEach((outputYear) =>  {
                for (var i = 0; i < dimension.years.length; i++) {
                    var year = dimension.years[i],
                        value = dimension.values[i],
                        entity = dimension.entities[i];

                    // Since scatterplots interrelate two variables via entity overlap, their datakeys are solely entity-based
                    const datakey = chart.data.keyFor(entity, 0)
                    
                    if (!validEntityLookup[entity])
                        continue

                    if ((dimension.property == 'x' || dimension.property == 'y') && !isNumber(value))
                        continue
                    
                    const targetYear = (dimension.property == 'x' && xOverrideYear != null) ? xOverrideYear : outputYear

                    // Skip years that aren't within tolerance of the target
                    if (year < targetYear-tolerance || year > targetYear+tolerance)
                        continue;

                    let dataByYear = dataByEntityAndYear.get(entity)
                    if (!dataByYear) {
                        dataByYear = new Map()
                        dataByEntityAndYear.set(entity, dataByYear)
                    }

                    let series = dataByYear.get(outputYear)
                    if (!series) {
                        series = {
                            key: datakey,
                            label: chart.data.formatKey(datakey),
                            values: [{ year: outputYear, time: {} }],
                            color: keyColors[datakey]
                        } as ScatterSeries
                        dataByYear.set(outputYear, series)
                    }

                    const d = series.values[0];

                    // Ensure we use the closest year to the target
                    const originYear = (d.time as any)[dimension.property];
                    if (isFinite(originYear) && Math.abs(originYear-targetYear) < Math.abs(year-targetYear))
                        continue;

                    if (dimension.property == 'color') {
                        if (!series.color) series.color = colorScale(value as string);
                    } else {
                        (d.time as any)[dimension.property] = year;
                        (d as any)[dimension.property] = value;
                    }
                }
            });
        });

        // Exclude any with data for only one axis
        dataByEntityAndYear.forEach((dataByYear, year) => {
            const newDataByYear = new Map();
            dataByYear.forEach((series, year) => {
                const datum = series.values[0];
                if (has(datum, 'x') && has(datum, 'y'))
                    newDataByYear.set(year, series);
            });
            dataByEntityAndYear.set(year, newDataByYear);
        });

        return dataByEntityAndYear;
    }    


    @computed get allGroups(): ScatterSeries[] {
        let allGroups: ScatterSeries[] = []
        this.dataByEntityAndYear.forEach(dataByYear => {
            dataByYear.forEach(group => {
                allGroups.push(group)
            })
        })
        return allGroups
    }

    @computed get allValues(): ScatterValue[] {
        const allValues: ScatterValue[] = []
        this.allGroups.forEach(group => allValues.push(...group.values))
        return allValues
    }

    @computed get currentValues(): ScatterValue[] {
        const currentValues: ScatterValue[] = []
        this.currentData.forEach(group => currentValues.push(...group.values))
        return currentValues
    }

    // domains across the entire timeline
    @computed get xDomainDefault() : [number, number] {
        if (!this.useTimelineDomains) {            
            return domainExtent(this.currentValues.map(d => d.x), this.xScaleType)
        }

        if (this.isRelativeMode) {
            let minChange = 0
            let maxChange = 0
            this.dataByEntityAndYear.forEach(dataByYear => {
                const values = Array.from(dataByYear.values()).map(g => g.values[0]).filter(v => v.x != 0 && v.y != 0)
                for (var i = 0; i < values.length; i++) {
                    const indexValue = values[i]
                    for (var j = i; j < values.length; j++) {
                        const targetValue = values[j]
                        const change = cagrX(indexValue, targetValue)
                        if (change < minChange) minChange = change
                        if (change > maxChange) maxChange = change
                    }
                }
           })
           return [minChange, maxChange]
        } else {
            return domainExtent(this.allValues.map(v => v.x), this.xScaleType)
        }
    }

    @computed get yDomainDefault(): [number, number] {
        if (!this.useTimelineDomains) {
            return domainExtent(this.currentValues.map(d => d.y), this.yScaleType)
        }

        if (this.isRelativeMode) {
            let minChange = 0
            let maxChange = 0
            this.dataByEntityAndYear.forEach(dataByYear => {
                const values = Array.from(dataByYear.values()).map(g => g.values[0]).filter(v => v.x != 0 && v.y != 0)
                for (var i = 0; i < values.length; i++) {
                    const indexValue = values[i]
                    for (var j = i; j < values.length; j++) {
                        const targetValue = values[j]
                        const change = cagrY(indexValue, targetValue)
                        if (change < minChange) minChange = change
                        if (change > maxChange) maxChange = change
                    }
                }
           })
           return [minChange, maxChange]
        } else {
            return domainExtent(this.allValues.map(v => v.y), this.yScaleType)
        }
    }

    @computed get sizeDomain(): [number, number] {
        const sizeValues: number[] = []
        this.allGroups.forEach(g => g.values[0].size && sizeValues.push(g.values[0].size))
        if (sizeValues.length == 0)
            return [1,1]
        else
            return domainExtent(sizeValues, 'linear')
    }

    @computed get colorsInUse(): string[] {
        return uniq(this.allGroups.map(s => s.color))
    }

    @computed get yScaleType() {
        return this.isRelativeMode ? 'linear' : this.chart.yAxis.scaleType
    }

    @computed get yAxisLabelBase(): string|undefined {
        if (this.chart.yAxis.label != null)
            return this.chart.yAxis.label

        return this.yDimension && this.yDimension.displayName
    }

    @computed get yAxis(): AxisSpec {
        const {chart, yDomainDefault, yDimension, isRelativeMode, yScaleType, yAxisLabelBase} = this
        
        const props: Partial<AxisSpec> = {}
        props.scaleType = yScaleType
        if (isRelativeMode) {
            props.domain = yDomainDefault
            props.scaleTypeOptions = ['linear']
            const label = yAxisLabelBase
            if (label && label.length > 1) {
                props.label = "Average annual change in " + (label.charAt(1).match(/[A-Z]/) ? label : label.charAt(0).toLowerCase() + label.slice(1))
            }
            props.tickFormat = (v: number) => formatValue(v, { unit: "%" })
        } else {
            props.label = yAxisLabelBase
            props.tickFormat = yDimension && yDimension.formatValueShort
        }

        return extend(chart.yAxis.toSpec({ defaultDomain: yDomainDefault }), props) as AxisSpec
    }

    @computed get xScaleType(): 'linear'|'log' {
        return this.isRelativeMode ? 'linear' : this.chart.xAxis.scaleType
    }

    @computed get xAxisLabelBase(): string|undefined {
        if (this.chart.xAxis.label != null)
            return this.chart.xAxis.label

        const xDimName = this.xDimension && this.xDimension.displayName
        if (this.xOverrideYear != null)
            return xDimName + " in " + this.xOverrideYear
        else
            return xDimName
    }

    @computed get xAxis(): AxisSpec {
        const {chart, xDomainDefault, xDimension, isRelativeMode, xScaleType, xAxisLabelBase} = this

        const props: Partial<AxisSpec> = {}
        props.scaleType = xScaleType
        if (isRelativeMode) {
            props.domain = xDomainDefault
            props.scaleTypeOptions = ['linear']
            const label = xAxisLabelBase
            if (label && label.length > 1) {
                props.label = "Average annual change in " + (label.charAt(1).match(/[A-Z]/) ? label : label.charAt(0).toLowerCase() + label.slice(1))
            }
            props.tickFormat = (v: number) => formatValue(v, { unit: "%" })
        } else {
            props.label = xAxisLabelBase
            props.tickFormat = xDimension && xDimension.formatValueShort
        }

        return extend(chart.xAxis.toSpec({ defaultDomain: xDomainDefault }), props) as AxisSpec
    }

    @computed get yFormatTooltip(): (d: number) => string {
        return (this.isRelativeMode || !this.yDimension) ? this.yAxis.tickFormat : this.yDimension.formatValueLong
    }

    @computed get xFormatTooltip(): (d: number) => string {
        return (this.isRelativeMode || !this.xDimension) ? this.xAxis.tickFormat : this.xDimension.formatValueLong
    }

    @computed get currentData(): ScatterSeries[] {
        if (!this.chart.data.isReady)
            return []

        const {dataByEntityAndYear, startYear, endYear, xScaleType, yScaleType, isRelativeMode, compareEndPointsOnly, xOverrideYear} = this
        let currentData: ScatterSeries[] = [];

        // As needed, join the individual year data points together to create an "arrow chart"
        dataByEntityAndYear.forEach(dataByYear => {
            let group: ScatterSeries|undefined
            dataByYear.forEach((groupForYear, year) => {
                if (year < startYear || year > endYear)
                    return

                group = group || extend({}, groupForYear, { values: [] }) as ScatterSeries
                group.values = group.values.concat(groupForYear.values)
                if (isNumber(groupForYear.values[0].size))
                    group.size = groupForYear.values[0].size
            })

            if (group && group.values.length) {
                group.size = last(group.values.map(v => v.size).filter(s => isNumber(s)))
                currentData.push(group)
            }
        });

        currentData = currentData.map(series => {
            // Only allow tolerance data to occur once in any given chart (no duplicate data points)
            // Prioritize the start and end years first, then the "true" year
            let values = series.values
            
            values = map(groupBy(values, v => v.time.y), (vals: ScatterValue[]) => 
                sortBy(vals, v => (v.year == startYear || v.year == endYear) ? -Infinity : Math.abs(v.year-v.time.y))[0]
            )

            if (xOverrideYear == null) {
                values = map(groupBy(values, v => v.time.x),(vals: ScatterValue[]) =>
                    sortBy(vals, v => (v.year == startYear || v.year == endYear) ? -Infinity : Math.abs(v.year-v.time.x))[0]
                )
            }

            // Don't allow values <= 0 for log scales
            if (yScaleType == 'log')
                values = values.filter(v => v.y > 0)            
            if (xScaleType == 'log')
                values = values.filter(v => v.x > 0)

            // Don't allow values *equal* to zero for CAGR mode
            if (isRelativeMode)
                values = values.filter(v => v.y != 0 && v.x != 0)

            return extend({}, series, {
                values: values
            })
        })

        currentData = currentData.filter(series => {
            // No point trying to render series with no valid points!
            if (series.values.length == 0)
                return false

            // Hide lines which don't cover the full span
            if (this.chart.props.hideLinesOutsideTolerance)
                return first(series.values).year == startYear && last(series.values).year == endYear
            
            return true
        })

        if (compareEndPointsOnly) {
            currentData.forEach(series => {
                series.values = series.values.length == 1 ? series.values : [first(series.values), last(series.values)]
            })
        }

        if (isRelativeMode) {
            currentData.forEach(series => {
                const indexValue = first(series.values)
                const targetValue = last(series.values)
                series.values = [{
                    x: cagrX(indexValue, targetValue),
                    y: cagrY(indexValue, targetValue),
                    size: targetValue.size,
                    year: targetValue.year,
                    time: {
                        y: targetValue.time.y,
                        x: targetValue.time.x,
                        span: [indexValue.time.y, targetValue.time.y]
                    }
                }]
            })
        }

        return currentData;
    }
}

function cagrX(indexValue: ScatterValue, targetValue: ScatterValue) {
    if (targetValue.year-indexValue.year == 0)
        return 0
    else {
        const frac = targetValue.x/indexValue.x
        if (frac < 0)
            return -(Math.pow(-frac, 1/(targetValue.year-indexValue.year)) - 1) * 100        
        else
            return (Math.pow(frac, 1/(targetValue.year-indexValue.year)) - 1) * 100
    }
}

function cagrY(indexValue: ScatterValue, targetValue: ScatterValue) {
    if (targetValue.year-indexValue.year == 0)
        return 0
    else {
        const frac = targetValue.y/indexValue.y
        if (frac < 0)
            return -(Math.pow(-frac, 1/(targetValue.year-indexValue.year)) - 1) * 100        
        else
            return (Math.pow(frac, 1/(targetValue.year-indexValue.year)) - 1) * 100
    }
}
