import { computed } from "mobx"
import {
    isEmpty,
    sortBy,
    orderBy,
    flatten,
    uniq,
    sortNumeric,
    sortedUniq,
} from "grapher/utils/Util"
import { DiscreteBarDatum } from "./DiscreteBarChart"
import { ChartTransform } from "grapher/chart/ChartTransform"
import { ColorSchemes } from "grapher/color/ColorSchemes"
import {
    SortOrder,
    TickFormattingOptions,
    ScaleType,
    Time,
} from "grapher/core/GrapherConstants"

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export class DiscreteBarTransform extends ChartTransform {
    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.grapher
        if (!filledDimensions.some((d) => d.property === "y"))
            return "Missing variable"
        else if (isEmpty(this.currentData)) return "No matching data"
        else return undefined
    }

    @computed get primaryDimensions() {
        return this.grapher.filledDimensions.filter((d) => d.property === "y")
    }

    @computed get availableTimes(): Time[] {
        return flatten(this.primaryDimensions.map((dim) => dim.yearsUniq))
    }

    @computed get hasTimeline(): boolean {
        return this.grapher.isLineChart && !this.grapher.hideTimeline
    }

    @computed get barValueFormat(): (datum: DiscreteBarDatum) => string {
        const { time } = this

        return (datum: DiscreteBarDatum) => {
            const showYearLabels =
                this.grapher.showYearLabels || datum.year !== time
            return (
                datum.formatValue(datum.value) +
                (showYearLabels
                    ? ` (${this.grapher.table.timeColumnFormatFunction(
                          datum.year
                      )})`
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
            ? primaryDimensions[0].formatValueShortFn
            : (d: number) => `${d}`
    }

    @computed get currentData(): DiscreteBarDatum[] {
        const { grapher } = this
        const targetYear = grapher.isLineChart
            ? grapher.lineChartTransform.time
            : this.time
        const { filledDimensions } = grapher
        const { selectedKeysByKey } = grapher
        const dataByEntityDimensionKey: {
            [entityDimensionKey: string]: DiscreteBarDatum
        } = {}

        filledDimensions.forEach((dimension, dimIndex) => {
            const { tolerance } = dimension

            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const entityName = dimension.entityNames[i]
                const entityDimensionKey = grapher.makeEntityDimensionKey(
                    entityName,
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
                    label: grapher.getLabelForKey(entityDimensionKey),
                    color: "#2E5778",
                    formatValue: dimension.formatValueShortFn,
                }

                dataByEntityDimensionKey[entityDimensionKey] = datum
            }
        })

        if (this.grapher.isLineChart) {
            // If derived from line chart, use line chart colors
            for (const key in dataByEntityDimensionKey) {
                const lineSeries = this.grapher.lineChartTransform.predomainData.find(
                    (series) => series.entityDimensionKey === key
                )
                if (lineSeries)
                    dataByEntityDimensionKey[key].color = lineSeries.color
            }
        } else {
            const data = sortBy(
                Object.values(dataByEntityDimensionKey),
                (d) => d.value
            )
            const colorScheme = grapher.baseColorScheme
                ? ColorSchemes[grapher.baseColorScheme]
                : undefined
            const uniqValues = uniq(data.map((d) => d.value))
            const colors = colorScheme?.getColors(uniqValues.length) || []
            if (grapher.invertColorScheme) colors.reverse()

            // We want to display same values using the same color, e.g. two values of 100 get the same shade of green
            // Therefore, we create a map from all possible (unique) values to the corresponding color
            const colorByValue = new Map<number, string>()
            uniqValues.forEach((value, i) => colorByValue.set(value, colors[i]))

            data.forEach((d) => {
                d.color =
                    grapher.keyColors[d.entityDimensionKey] ||
                    colorByValue.get(d.value) ||
                    d.color
            })
        }

        if (this.isLogScale)
            this._filterDataForLogScaleInPlace(dataByEntityDimensionKey)

        return orderBy(
            Object.values(dataByEntityDimensionKey),
            ["value", "key"],
            ["desc", "asc"]
        )
    }

    private _filterDataForLogScaleInPlace(dataByEntityDimensionKey: {
        [entityDimensionKey: string]: DiscreteBarDatum
    }) {
        Object.keys(dataByEntityDimensionKey).forEach((key) => {
            const datum = dataByEntityDimensionKey[key]
            if (datum.value <= 0) delete dataByEntityDimensionKey[key]
        })
    }

    private _filterArrayForLogScale(allData: DiscreteBarDatum[]) {
        // It seems the approach we follow with log scales in the other charts is to filter out zero values.
        // This is because, as d3 puts it: "a log scale domain must be strictly-positive or strictly-negative;
        // the domain must not include or cross zero". We may want to update to d3 5.8 and explore switching to
        // scaleSymlog which handles a wider domain.
        return allData.filter((datum) => datum.value > 0)
    }

    @computed get isLogScale() {
        return this.grapher.yAxis.scaleType === ScaleType.log
    }

    @computed get allData(): DiscreteBarDatum[] {
        if (!this.hasTimeline) {
            return this.currentData
        }

        const { grapher } = this
        const { selectedKeysByKey } = grapher
        const filledDimensions = grapher.filledDimensions
        const allData: DiscreteBarDatum[] = []

        filledDimensions.forEach((dimension, dimIndex) => {
            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const entityName = dimension.entityNames[i]
                const entityDimensionKey = grapher.makeEntityDimensionKey(
                    entityName,
                    dimIndex
                )

                if (!selectedKeysByKey[entityDimensionKey]) continue

                const datum = {
                    entityDimensionKey,
                    value: +dimension.values[i],
                    year: year,
                    label: grapher.getLabelForKey(entityDimensionKey),
                    color: "#2E5778",
                    formatValue: dimension.formatValueShortFn,
                }

                allData.push(datum)
            }
        })

        const filteredData = this.isLogScale
            ? this._filterArrayForLogScale(allData)
            : allData

        const data = sortNumeric(filteredData, (d) => d.value)
        const colorScheme = grapher.baseColorScheme
            ? ColorSchemes[grapher.baseColorScheme]
            : undefined
        const uniqValues = sortedUniq(data.map((d) => d.value))
        const colors = colorScheme?.getColors(uniqValues.length) || []
        if (grapher.invertColorScheme) colors.reverse()

        const colorByValue = new Map<number, string>()
        uniqValues.forEach((value, i) => colorByValue.set(value, colors[i]))

        data.forEach((d) => {
            d.color =
                grapher.keyColors[d.entityDimensionKey] ||
                colorByValue.get(d.value) ||
                d.color
        })

        return sortNumeric(data, (d) => d.value, SortOrder.desc)
    }
}
