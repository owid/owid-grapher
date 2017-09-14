import {computed} from 'mobx'
import {some, isEmpty, find, sortBy, max, values} from './Util'
import ChartConfig from './ChartConfig'
import Color from './Color'
import {DiscreteBarDatum} from './DiscreteBarChart'
import ColorBinder from './ColorBinder'
import IChartTransform from './IChartTransform'
import DimensionWithData from './DimensionWithData'

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export default class DiscreteBarTransform implements IChartTransform {
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
            return "Missing variable"
        else if (isEmpty(this.data))
            return "No matching data"
        else
            return undefined
    }

	@computed get baseColorScheme(): Color[] {
		return ["#F2585B"]
	}

    @computed get colors(): ColorBinder {
        const _this = this
        return new ColorBinder({
            get chart() { return _this.chart },
            get colorScheme() { return _this.baseColorScheme }
        })
    }

    @computed get primaryDimension(): DimensionWithData|undefined {
        return find(this.chart.data.filledDimensions, d => d.property == "y")
    }

    @computed get targetYear(): number {
        const maxYear = this.chart.timeDomain[1]
        if (!this.primaryDimension) return 1900

        const {variable} = this.primaryDimension
        if (maxYear != null)
            return sortBy(variable.yearsUniq, year => Math.abs(year-maxYear))[0];
        else
            return max(variable.yearsUniq) as number;

    }

    @computed get barValueFormat(): (datum: DiscreteBarDatum) => string {
        const {chart, primaryDimension, targetYear} = this
        const formatValue = primaryDimension ? primaryDimension.formatValueShort : chart.yAxis.tickFormat

        return (datum: DiscreteBarDatum) => {
            return formatValue(datum.value) + (datum.year != targetYear ? " (in " + datum.year + ")" : "")
        }
    }

    @computed get data(): DiscreteBarDatum[] {
		const {chart, targetYear, colors} = this
        const {filledDimensions, selectedKeysByKey} = chart.data
        const dataByKey: {[key: string]: DiscreteBarDatum} = {}

		filledDimensions.forEach((dimension, dimIndex) => {
            const {tolerance} = dimension

			for (var i = 0; i < dimension.years.length; i++) {
				const year = dimension.years[i]
				const entity = dimension.entities[i]
				const datakey = chart.data.keyFor(entity, dimIndex)

				if (year < targetYear-tolerance || year > targetYear+tolerance || !selectedKeysByKey[datakey]) 
                    continue;

                const currentDatum = dataByKey[datakey]
                // Make sure we use the closest value to the target year within tolerance (preferring later)
                if (currentDatum && Math.abs(currentDatum.year-targetYear) < Math.abs(year-targetYear))
                    continue

                const datum = {
                    value: +dimension.values[i],
                    year: year,
                    label: chart.data.formatKey(datakey),
                    color: colors.getColorForKey(datakey)
                }

                dataByKey[datakey] = datum
			}
		});

        return sortBy(values(dataByKey), d => -d.value)
    }
}