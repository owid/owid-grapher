import { computed } from "mobx"
import {
    some,
    isEmpty,
    sortBy,
    orderBy,
    values,
    flatten,
    uniq,
    sortedUniq
} from "./Util"
import { DiscreteBarDatum } from "./DiscreteBarChart"
import { ChartTransform } from "./ChartTransform"
import { DimensionWithData } from "./DimensionWithData"
import { ColorSchemes } from "./ColorSchemes"
import { TickFormattingOptions } from "./TickFormattingOptions"
import { Time } from "./TimeBounds"

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export class DiscreteBarTransform extends ChartTransform {
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

    @computed get timelineYears(): Time[] {
        return sortedUniq(
            sortBy(
                flatten(
                    this.primaryDimensions.map(dim => dim.variable.yearsUniq)
                )
            )
        )
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
                (showYearLabels
                    ? ` (${this.chart.formatYearFunction(datum.year)})`
                    : "")
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
                const datakey = chart.data.makeEntityDimensionKey(
                    entity,
                    dimIndex
                )

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
                    label: chart.data.getLabelForKey(datakey),
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

        if (this.isLogScale) this._filterDataForLogScaleInPlace(dataByKey)

        return orderBy(values(dataByKey), ["value", "key"], ["desc", "asc"])
    }

    private _filterDataForLogScaleInPlace(dataByKey: {
        [key: string]: DiscreteBarDatum
    }) {
        Object.keys(dataByKey).forEach(key => {
            const datum = dataByKey[key]
            if (datum.value === 0) delete dataByKey[key]
        })
    }

    private _filterArrayForLogScale(allData: DiscreteBarDatum[]) {
        // It seems the approach we follow with log scales in the other charts is to filter out zero values.
        // This is because, as d3 puts it: "a log scale domain must be strictly-positive or strictly-negative;
        // the domain must not include or cross zero". We may want to update to d3 5.8 and explore switching to
        // scaleSymlog which handles a wider domain.
        return allData.filter(datum => datum.value !== 0)
    }

    @computed get isLogScale() {
        return this.chart.yAxis.scaleType === "log"
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
                const datakey = chart.data.makeEntityDimensionKey(
                    entity,
                    dimIndex
                )

                if (!selectedKeysByKey[datakey]) continue

                const datum = {
                    key: datakey,
                    value: +dimension.values[i],
                    year: year,
                    label: chart.data.getLabelForKey(datakey),
                    color: "#2E5778",
                    formatValue: dimension.formatValueShort
                }

                allData.push(datum)
            }
        })

        const filteredData = this.isLogScale
            ? this._filterArrayForLogScale(allData)
            : allData

        const data = sortBy(filteredData, d => d.value)
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
