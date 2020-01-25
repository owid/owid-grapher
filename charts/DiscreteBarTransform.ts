import { computed } from "mobx"
import {
    some,
    isEmpty,
    sortBy,
    orderBy,
    max,
    values,
    flatten,
    uniq
} from "./Util"
import { ChartConfig } from "./ChartConfig"
import { DiscreteBarDatum } from "./DiscreteBarChart"
import { IChartTransform } from "./IChartTransform"
import { DimensionWithData } from "./DimensionWithData"
import { ColorSchemes } from "./ColorSchemes"
import { TickFormattingOptions } from "./TickFormattingOptions"

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export class DiscreteBarTransform implements IChartTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get isValidConfig(): boolean {
        return some(this.chart.dimensions, d => d.property === "y")
    }

    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.chart.data
        if (!some(filledDimensions, d => d.property === "y"))
            return "Missing variable"
        else if (isEmpty(this.currentData)) return "No matching data"
        else return undefined
    }

    @computed get primaryDimensions(): DimensionWithData[] {
        return this.chart.data.filledDimensions.filter(d => d.property === "y")
    }

    @computed get targetYear(): number {
        const maxYear = this.chart.timeDomain[1]
        if (this.primaryDimensions.length === 0) return 1900

        const yearsUniq = flatten(
            this.primaryDimensions.map(dim => dim.variable.yearsUniq)
        )
        if (maxYear !== undefined)
            return sortBy(yearsUniq, year => Math.abs(year - maxYear))[0]
        else return max(yearsUniq) as number
    }

    @computed get hasTimeline(): boolean {
        return this.chart.isLineChart && !this.chart.props.hideTimeline
    }

    @computed get barValueFormat(): (datum: DiscreteBarDatum) => string {
        const { targetYear } = this

        return (datum: DiscreteBarDatum) => {
            const showYearLabels =
                this.chart.props.showYearLabels || datum.year !== targetYear
            return (
                datum.formatValue(datum.value) +
                (showYearLabels ? ` (in ${datum.year})` : "")
            )
        }
    }

    @computed get tickFormat(): (
        d: number,
        options?: TickFormattingOptions
    ) => string {
        const { primaryDimensions } = this
        return primaryDimensions[0]
            ? primaryDimensions[0].formatValueShort
            : (d: number) => `${d}`
    }

    @computed get currentData(): DiscreteBarDatum[] {
        const { chart, targetYear } = this
        const { filledDimensions, selectedKeysByKey } = chart.data
        const dataByKey: { [key: string]: DiscreteBarDatum } = {}

        filledDimensions.forEach((dimension, dimIndex) => {
            const { tolerance } = dimension

            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const entity = dimension.entities[i]
                const datakey = chart.data.keyFor(entity, dimIndex)

                if (
                    year < targetYear - tolerance ||
                    year > targetYear + tolerance ||
                    !selectedKeysByKey[datakey]
                )
                    continue

                const currentDatum = dataByKey[datakey]
                // Make sure we use the closest value to the target year within tolerance (preferring later)
                if (
                    currentDatum &&
                    Math.abs(currentDatum.year - targetYear) <
                    Math.abs(year - targetYear)
                )
                    continue

                const datum = {
                    key: datakey,
                    value: +dimension.values[i],
                    year: year,
                    label: chart.data.formatKey(datakey),
                    color: "#2E5778",
                    formatValue: dimension.formatValueShort
                }

                dataByKey[datakey] = datum
            }
        })

        if (this.chart.isLineChart) {
            // If derived from line chart, use line chart colors
            for (const key in dataByKey) {
                const lineSeries = this.chart.lineChart.predomainData.find(
                    series => series.key === key
                )
                if (lineSeries) dataByKey[key].color = lineSeries.color
            }
        } else {
            const data = sortBy(values(dataByKey), d => d.value)
            const colorScheme = chart.baseColorScheme
                ? ColorSchemes[chart.baseColorScheme]
                : undefined
            const uniqValues = uniq(data.map(d => d.value))
            const colors = colorScheme?.getColors(uniqValues.length) || []
            if (chart.props.invertColorScheme) colors.reverse()

            // We want to display same values using the same color, e.g. two values of 100 get the same shade of green
            // Therefore, we create a map from all possible (unique) values to the corresponding color
            const colorByValue = new Map<number, string>()
            uniqValues.forEach((value, i) => colorByValue.set(value, colors[i]))

            data.forEach(d => {
                d.color =
                    chart.data.keyColors[d.key] ||
                    colorByValue.get(d.value) ||
                    d.color
            })
        }

        return orderBy(values(dataByKey), ["value", "key"], ["desc", "asc"])
    }

    @computed get allData(): DiscreteBarDatum[] {
        if (!this.hasTimeline) {
            return this.currentData
        }

        const { chart } = this
        const { filledDimensions, selectedKeysByKey } = chart.data
        const allData: DiscreteBarDatum[] = []

        filledDimensions.forEach((dimension, dimIndex) => {
            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const entity = dimension.entities[i]
                const datakey = chart.data.keyFor(entity, dimIndex)

                if (!selectedKeysByKey[datakey]) continue

                const datum = {
                    key: datakey,
                    value: +dimension.values[i],
                    year: year,
                    label: chart.data.formatKey(datakey),
                    color: "#2E5778",
                    formatValue: dimension.formatValueShort
                }

                allData.push(datum)
            }
        })

        const data = sortBy(allData, d => d.value)
        const colorScheme = chart.baseColorScheme
            ? ColorSchemes[chart.baseColorScheme]
            : undefined
        const uniqValues = uniq(data.map(d => d.value))
        const colors = colorScheme?.getColors(uniqValues.length) || []
        if (chart.props.invertColorScheme) colors.reverse()

        const colorByValue = new Map<number, string>()
        uniqValues.forEach((value, i) => colorByValue.set(value, colors[i]))

        data.forEach(d => {
            d.color =
                chart.data.keyColors[d.key] ||
                colorByValue.get(d.value) ||
                d.color
        })

        return sortBy(data, d => -d.value)
    }
}
