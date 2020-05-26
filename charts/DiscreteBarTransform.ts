import { computed } from "mobx"
import { some, isEmpty, sortBy, orderBy, values, flatten, uniq } from "./Util"
import { DiscreteBarDatum } from "./DiscreteBarChart"
import { ChartTransform } from "./ChartTransform"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
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

    @computed get primaryDimensions(): ChartDimensionWithOwidVariable[] {
        return this.chart.data.filledDimensions.filter(d => d.property === "y")
    }

    @computed get availableYears(): Time[] {
        return flatten(
            this.primaryDimensions.map(dim => dim.variable.yearsUniq)
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
        const dataByEntityDimensionKey: {
            [entityDimensionKey: string]: DiscreteBarDatum
        } = {}

        filledDimensions.forEach((dimension, dimIndex) => {
            const { tolerance } = dimension

            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const entity = dimension.entityNames[i]
                const entityDimensionKey = chart.data.makeEntityDimensionKey(
                    entity,
                    dimIndex
                )

                if (
                    year < targetYear - tolerance ||
                    year > targetYear + tolerance ||
                    !selectedKeysByKey[entityDimensionKey]
                )
                    continue

                const currentDatum =
                    dataByEntityDimensionKey[entityDimensionKey]
                // Make sure we use the closest value to the target year within tolerance (preferring later)
                if (
                    currentDatum &&
                    Math.abs(currentDatum.year - targetYear) <
                        Math.abs(year - targetYear)
                )
                    continue

                const datum = {
                    entityDimensionKey,
                    value: +dimension.values[i],
                    year: year,
                    label: chart.data.getLabelForKey(entityDimensionKey),
                    color: "#2E5778",
                    formatValue: dimension.formatValueShort
                }

                dataByEntityDimensionKey[entityDimensionKey] = datum
            }
        })

        if (this.chart.isLineChart) {
            // If derived from line chart, use line chart colors
            for (const key in dataByEntityDimensionKey) {
                const lineSeries = this.chart.lineChart.predomainData.find(
                    series => series.entityDimensionKey === key
                )
                if (lineSeries)
                    dataByEntityDimensionKey[key].color = lineSeries.color
            }
        } else {
            const data = sortBy(values(dataByEntityDimensionKey), d => d.value)
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
                    chart.data.keyColors[d.entityDimensionKey] ||
                    colorByValue.get(d.value) ||
                    d.color
            })
        }

        if (this.isLogScale)
            this._filterDataForLogScaleInPlace(dataByEntityDimensionKey)

        return orderBy(
            values(dataByEntityDimensionKey),
            ["value", "key"],
            ["desc", "asc"]
        )
    }

    private _filterDataForLogScaleInPlace(dataByEntityDimensionKey: {
        [entityDimensionKey: string]: DiscreteBarDatum
    }) {
        Object.keys(dataByEntityDimensionKey).forEach(key => {
            const datum = dataByEntityDimensionKey[key]
            if (datum.value <= 0) delete dataByEntityDimensionKey[key]
        })
    }

    private _filterArrayForLogScale(allData: DiscreteBarDatum[]) {
        // It seems the approach we follow with log scales in the other charts is to filter out zero values.
        // This is because, as d3 puts it: "a log scale domain must be strictly-positive or strictly-negative;
        // the domain must not include or cross zero". We may want to update to d3 5.8 and explore switching to
        // scaleSymlog which handles a wider domain.
        return allData.filter(datum => datum.value > 0)
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
                const entity = dimension.entityNames[i]
                const entityDimensionKey = chart.data.makeEntityDimensionKey(
                    entity,
                    dimIndex
                )

                if (!selectedKeysByKey[entityDimensionKey]) continue

                const datum = {
                    entityDimensionKey,
                    value: +dimension.values[i],
                    year: year,
                    label: chart.data.getLabelForKey(entityDimensionKey),
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
                chart.data.keyColors[d.entityDimensionKey] ||
                colorByValue.get(d.value) ||
                d.color
        })

        return sortBy(data, d => -d.value)
    }
}
