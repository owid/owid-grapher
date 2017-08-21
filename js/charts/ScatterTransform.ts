import * as _ from 'lodash'
import * as d3 from 'd3'
import ChartConfig from './ChartConfig'
import {computed, observable, extras} from 'mobx'
import {defaultTo, first, last} from './Util'
import {DimensionWithData} from './ChartData'
import {ScatterSeries, ScatterValue} from './PointsWithLabels'
import AxisSpec from './AxisSpec'
import {formatValue} from './Util'

// Responsible for translating chart configuration into the form
// of a scatter plot
export default class ScatterTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) { 
        this.chart = chart
    }

    @computed get failMessage(): string|undefined {
        const {filledDimensions} = this.chart.data
        if (!_.some(filledDimensions, d => d.property == 'y'))
            return "Missing Y axis variable"
        else if (!_.some(filledDimensions, d => d.property == 'x'))
            return "Missing X axis variable"
        else if (_.isEmpty(this.currentData))
            return "No matching data"
    }

    // Scatterplot should have exactly one dimension for each of x and y
    // The y dimension is treated as the "primary" variable
    @computed get yDimension(): DimensionWithData {
        return _.find(this.chart.data.filledDimensions, d => d.property == 'y') as DimensionWithData
    }
    @computed get xDimension(): DimensionWithData {
        return _.find(this.chart.data.filledDimensions, d => d.property == 'x') as DimensionWithData
    }
    @computed get axisDimensions(): [DimensionWithData, DimensionWithData] {
        console.assert(this.yDimension)
        console.assert(this.xDimension)
        return [this.yDimension, this.xDimension]
    }

    // In relative mode, the timeline scatterplot calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode() {
		return this.chart.props.stackMode == 'relative'
    }

    @computed get hideBackgroundEntities() {
        return this.chart.addCountryMode == 'disabled'
    }

    @computed get validEntities() {
        if (this.hideBackgroundEntities)
            return this.chart.data.selectedKeys.map(datakey => this.chart.data.lookupKey(datakey).entity)
        else
            return _.intersection(
                this.axisDimensions[0].variable.entitiesUniq,
                this.axisDimensions[1].variable.entitiesUniq
            )
    }

    @computed get availableYears(): number[] {
        if (!this.chart.timeline) {
            // If there's no timeline, we're just showing a single target year
            let maxYear = this.chart.timeDomain[1]
            if (!_.isFinite(maxYear))
                maxYear = _(this.axisDimensions).map(d => d.variable.maxYear).max() as number
            return [maxYear] as number[]
        }

        // For timeline scatters, allow years with at least some data for both variables
        return (_.intersection(
            this.axisDimensions[0].variable.yearsUniq, 
            this.axisDimensions[1].variable.yearsUniq
        ) as number[])
    }

    @computed get colorScheme() : string[] {
        return [ // TODO less ad hoc color scheme (probably would have to annotate the datasets)
            "#5675c1", // Africa
            "#aec7e8", // Antarctica
            "#d14e5b", // Asia
            "#ffd336", // Europe
            "#4d824b", // North America
            "#a652ba", // Oceania
            "#69c487", // South America
            "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]
    }

    @computed get colorScale(): d3.ScaleOrdinal<string, string> {
        const {colorScheme} = this
        const colorDim = this.chart.data.dimensionsByField['color']

        const colorScale = d3.scaleOrdinal(this.colorScheme)
        if (colorDim) {
            colorScale.domain(colorDim.variable.categoricalValues);
        }

        return colorScale
    }

    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    @computed get dataByEntityAndYear() {
        const {chart, availableYears, colorScale, hideBackgroundEntities, validEntities} = this
        const {filledDimensions, keyColors} = chart.data
        const validEntityLookup = _.keyBy(validEntities)
        
        let dataByEntityAndYear = new Map<string, Map<number, ScatterSeries>>()

        // The data values
        _.each(filledDimensions, (dimension, dimIndex) => {
            var variable = dimension.variable,
                tolerance = (dimension.property == 'color' || dimension.property == 'size') ? Infinity : dimension.tolerance;

            _.each(availableYears, (outputYear) =>  {
                for (var i = 0; i < variable.years.length; i++) {
                    var year = variable.years[i],
                        value = variable.values[i],
                        entity = variable.entities[i];

                    // Since scatterplots interrelate two variables via entity overlap, their datakeys are solely entity-based
                    const datakey = chart.data.keyFor(entity, 0)
                    
                    if (!validEntityLookup[entity])
                        continue

                    if ((dimension.property == 'x' || dimension.property == 'y') && !_.isNumber(value))
                        continue
    
                    const targetYear = (!chart.timeline && _.isFinite(dimension.targetYear)) ? (dimension.targetYear as number) : outputYear

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
                    if (_.isFinite(originYear) && Math.abs(originYear-targetYear) < Math.abs(year-targetYear))
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
        _.each(dataByEntityAndYear, function(v, k) {
            var newDataByYear = new Map();
            _.each(v, function(series, year) {
                var datum = series.values[0];
                if (_.has(datum, 'x') && _.has(datum, 'y'))
                    newDataByYear.set(year, series);
            });
            dataByEntityAndYear.set(k, newDataByYear);
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
        return _(this.allGroups).map(group => group.values).flatten().value() as ScatterValue[]
    }

    // domains across the entire timeline
    @computed get xDomainDefault() : [number, number] {
        if (this.isRelativeMode) {
            const changes: number[] = []
            this.dataByEntityAndYear.forEach(dataByYear => {
                const extent = d3.extent(Array.from(dataByYear.values()).map(group => group.values[0].x)) as [number, number]
                changes.push(extent[1]-extent[0])
            })
            const maxChange = _.max(changes)
            return [-(maxChange as number), maxChange] as [number, number]
        } else {
            if (this.chart.xAxis.scaleType == 'log')
                return d3.extent(_(this.allValues).map('x').filter(v => v > 0).value()) as [number, number]
            else
                return d3.extent(_.map(this.allValues, 'x')) as [number, number]
        }
    }

    @computed get yDomainDefault() : [number, number] {
        if (this.isRelativeMode) {
            const changes: number[] = []
            this.dataByEntityAndYear.forEach(dataByYear => {
                const extent = d3.extent(Array.from(dataByYear.values()).map(group => group.values[0].y)) as [number, number]
                changes.push(extent[1]-extent[0])
            })
            const maxChange = _.max(changes)
            return [-(maxChange as number), maxChange] as [number, number]
        } else {
            if (this.chart.yAxis.scaleType == 'log')
                return d3.extent(_.chain(this.allValues).map('y').filter(v => v > 0).value()) as [number, number]
            else
                return d3.extent(_.map(this.allValues, 'y')) as [number, number]
        }
    }

    @computed get sizeDomain(): [number, number] {
        const sizeValues = _(this.allGroups).map(g => g.values[0].size).filter(_.identity).value()
        if (sizeValues.length == 0)
            return [1,1]
        else
            return d3.extent(sizeValues) as [number, number]
    }

    @computed get colorsInUse(): string[] {
        return _(this.allGroups).map(s => s.color).uniq().value()
    }

    @computed get yScaleType() {
        return this.isRelativeMode ? 'linear' : this.chart.xAxis.scaleType
    }

    @computed get yAxis(): AxisSpec {
        const {chart, yDomainDefault, yDimension, isRelativeMode, yScaleType} = this
		const tickFormat = (d: number) => formatValue(d, { unit: yDimension.variable.shortUnit })

        const props: Partial<AxisSpec> = { tickFormat: tickFormat }
        props.scaleType = yScaleType
        if (isRelativeMode) {
            props.domain = yDomainDefault
            props.scaleTypeOptions = ['linear']
            //props.tickFormat = (v: number) => formatValue(v, { unit: "%" })
        }

        return _.extend(chart.yAxis.toSpec({ defaultDomain: yDomainDefault }), props) as AxisSpec
    }

    @computed get xScaleType() {
        return this.isRelativeMode ? 'linear' : this.chart.xAxis.scaleType
    }

    @computed get xAxis(): AxisSpec {
        const {chart, xDomainDefault, xDimension, isRelativeMode, xScaleType} = this
		const tickFormat = (d: number) => formatValue(d, { unit: xDimension.variable.shortUnit })

        const props: Partial<AxisSpec> = { tickFormat: tickFormat }
        props.scaleType = xScaleType
        if (isRelativeMode) {
            props.domain = xDomainDefault
            props.scaleTypeOptions = ['linear']
            //props.tickFormat = (v: number) => formatValue(v, { unit: "%" })
        }

        return _.extend(chart.xAxis.toSpec({ defaultDomain: xDomainDefault }), props) as AxisSpec
    }

    @computed get defaultStartYear(): number { return first(this.availableYears) as number }
    @computed get startYear(): number {
        const {chart, defaultStartYear} = this
        if (_.isFinite(chart.timeDomain[0]))
            return Math.max(defaultStartYear, chart.timeDomain[0] as number)
        else
            return defaultStartYear
    }

    @computed get defaultEndYear(): number { return last(this.availableYears) as number }
    @computed get endYear(): number {
        const {chart, defaultEndYear} = this        
        if (_.isFinite(chart.timeDomain[1]))
            return Math.min(defaultEndYear, chart.timeDomain[1] as number)
        else
            return defaultEndYear
    }

    @computed get currentData(): ScatterSeries[] {
        const {dataByEntityAndYear, startYear, endYear, xScaleType, yScaleType, isRelativeMode} = this
        const {timeline} = this.chart
        let currentData: ScatterSeries[] = [];

        // As needed, join the individual year data points together to create an "arrow chart"
        dataByEntityAndYear.forEach(dataByYear => {
            let group: ScatterSeries|undefined
            dataByYear.forEach((groupForYear, year) => {
                if (year < startYear || year > endYear)
                    return

                group = group || _.extend({}, groupForYear, { values: [] }) as ScatterSeries
                group.values = group.values.concat(groupForYear.values)
                if (_.isNumber(groupForYear.values[0].size))
                    group.size = groupForYear.values[0].size
            })

            if (group && group.values.length) {
                group.size = _(group.values).map(v => v.size).filter(s => _.isNumber(s)).last() as number
                currentData.push(group)
            }
        });

        currentData = _.map(currentData, series => {
            // Only allow tolerance data to occur once in any given chart (no duplicate data points)
            // Prioritize the start and end years first, then the "true" year
            let values = series.values
            
            values = _(values).groupBy(v => v.time.y).map((vals: ScatterValue[]) => 
                _.sortBy(vals, v => (v.year == startYear || v.year == endYear) ? -Infinity : Math.abs(v.year-v.time.y))[0]
            ).value()

            values = _(values).groupBy(v => v.time.x).map((vals: ScatterValue[]) =>
                _.sortBy(vals, v => (v.year == startYear || v.year == endYear) ? -Infinity : Math.abs(v.year-v.time.x))[0]
            ).value()

            // Don't allow values <= 0 for log scales
            values = _.filter(values, v => {
                return (v.y > 0 || yScaleType != 'log') && (v.x > 0 || xScaleType != 'log')
            })

            return _.extend({}, series, {
                values: values
            })
        })

        currentData = _.filter(currentData, series => {
            return series.values.length > 0 && ((first(series.values).year == startYear && (last(series.values).year == endYear || first(series.values).year == startYear)) || _.includes(this.chart.data.selectedKeys, series.key))
        })

        if (timeline && timeline.compareEndPointsOnly) {
            _.each(currentData, series => {
                series.values = series.values.length == 1 ? series.values : [first(series.values), last(series.values)]
            })
        }

        if (isRelativeMode) {
            _.each(currentData, series => {
                const indexValue = first(series.values)
                const targetValue = last(series.values)
                series.values = [{
                    x: targetValue.x-indexValue.x,
                    y: targetValue.y-indexValue.y,
                    size: targetValue.size,
                    year: targetValue.year,
                    time: targetValue.time
                }]
            })
        }

        return currentData;
    }
}