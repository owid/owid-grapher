import {scaleOrdinal} from 'd3-scale'
import {some, union, min, max, find, isEmpty} from './Util'
import {computed} from 'mobx'
import ChartConfig from './ChartConfig'
import {defaultTo, findClosest} from './Util'
import DimensionWithData from './DimensionWithData'
import Observations from './Observations'
import {SlopeChartSeries} from './LabelledSlopes'
import {first, last, makeSafeForCSS} from './Util'
import IChartTransform from './IChartTransform'
import ColorSchemes from './ColorSchemes'

// Responsible for translating chart configuration into the form
// of a line chart
export default class SlopeChartTransform implements IChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

	@computed get isValidConfig(): boolean {
		return some(this.chart.dimensions, d => d.property == 'y')
	}

    @computed get failMessage(): string|undefined {
        const {filledDimensions} = this.chart.data
        if (!some(filledDimensions, d => d.property == 'y'))
            return "Missing Y axis variable"
        else if (isEmpty(this.data))
            return "No matching data"
		else
			return undefined
    }

    @computed get timelineYears(): number[] {
        return union(...this.chart.data.axisDimensions.map(d => d.variable.yearsUniq))
    }

    @computed get minTimelineYear(): number {
        return defaultTo(min(this.timelineYears), 1900)
    }

    @computed get maxTimelineYear(): number {
        return defaultTo(max(this.timelineYears), 2000)
    }

    @computed get startYear(): number {
        const minYear = defaultTo(this.chart.timeDomain[0], this.minTimelineYear)
        return defaultTo(findClosest(this.timelineYears, minYear), this.minTimelineYear)
    }

    @computed get endYear(): number {
        const maxYear = defaultTo(this.chart.timeDomain[1], this.maxTimelineYear)
        return defaultTo(findClosest(this.timelineYears, maxYear), this.maxTimelineYear)
    }

	@computed.struct get xDomain() : [number|null, number|null] {
		return [this.startYear, this.endYear]
	}

	@computed.struct get sizeDim(): DimensionWithData {
		return find(this.chart.data.filledDimensions, d => d.property == 'size') as DimensionWithData
	}

	@computed.struct get colorDim(): DimensionWithData {
		return find(this.chart.data.filledDimensions, d => d.property == 'color') as DimensionWithData
	}

	@computed.struct get yDim(): DimensionWithData {
		return find(this.chart.data.filledDimensions, d => d.property == 'y') as DimensionWithData
	}

	@computed get variableData() : Observations {
		const variables = this.chart.data.filledDimensions.map(d => d.variable)
		let obvs : any[]= []
		variables.forEach(v => {
			for (var i = 0; i < v.years.length; i++) {
				let d: any = { year: v.years[i], entity: v.entities[i] }
				d[v.id] = v.values[i]
				obvs.push(d)
			}
		})
		return new Observations(obvs)
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
        const {colorDim} = this

        const colorScheme = baseColorScheme && ColorSchemes[baseColorScheme]
        if (!colorScheme) return this.defaultColors
        else if (!colorDim) return colorScheme.getColors(4)
        else return colorScheme.getColors(colorDim.variable.categoricalValues.length)
    }

    @computed get colorScale(): d3.ScaleOrdinal<string, string> {
        const colorDim = this.chart.data.dimensionsByField['color']

        const colorScale = scaleOrdinal(this.colorScheme)
        if (colorDim) {
            colorScale.domain(colorDim.variable.categoricalValues);
        }

        return colorScale
    }

	@computed get data() : SlopeChartSeries[] {
		if (isEmpty(this.yDim)) return []
		let {variableData, sizeDim, yDim, xDomain, colorDim, colorScale} = this
		let data = variableData
		const entityKey = this.chart.vardata.entityMetaByKey

		// Make sure we're using time bounds that actually contain data
		const longestRange: number[] = data.filter((d: any) => isFinite(d[yDim.variable.id]))
			.mergeBy('entity', (rows: Observations) => rows.pluck('year'))
			.sortBy((d: number[]) => last(d)-first(d))
			.last() as number[]

		const minYear = xDomain[0] == null ? first(longestRange) : Math.max(xDomain[0]||-Infinity, first(longestRange))
		const maxYear = xDomain[1] == null ? last(longestRange) : Math.min(xDomain[1]||Infinity, last(longestRange))

		data = data.mergeBy('entity', (rows : Observations, entity : string) => {
			return {
				label: entityKey[entity].name,
				key: makeSafeForCSS(entityKey[entity].name),
				color: colorScale(rows.first(colorDim.variable.id)),
				size: rows.first(sizeDim.variable.id),
				values: rows.filter((d: any) => isFinite(d[yDim.variable.id]) && (d.year == minYear || d.year == maxYear)).mergeBy('year').map((d: any) => {
					return {
						x: d.year,
						y: d[yDim.variable.id]
					}
				}).toArray()
			}
		}).filter((d: any) => d.values.length >= 2)

		return data.toArray() as SlopeChartSeries[]
	}
}