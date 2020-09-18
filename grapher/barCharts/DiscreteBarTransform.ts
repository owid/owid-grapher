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
    @computed get failMessage() {
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
        return flatten(
            this.primaryDimensions.map((dim) => dim.column.timesUniq)
        )
    }

    @computed get hasTimeline() {
        return this.grapher.isLineChart && !this.grapher.hideTimeline
    }

    @computed get barValueFormat(): (datum: DiscreteBarDatum) => string {
        const { endTimelineTime } = this

        return (datum: DiscreteBarDatum) => {
            const showYearLabels =
                this.grapher.showYearLabels || datum.year !== endTimelineTime
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
            ? primaryDimensions[0].column.formatValueShort
            : (d: number) => `${d}`
    }

    @computed get currentData() {
        const { grapher } = this
        const { table, filledDimensions } = grapher
        const targetYear = grapher.isLineChart
            ? grapher.lineChartTransform.endTimelineTime
            : this.endTimelineTime
        const {
            selectedEntityNameSet,
            getColorForEntityName,
            getLabelForEntityName,
        } = table
        const dataByEntityName: {
            [entityName: string]: DiscreteBarDatum
        } = {}

        filledDimensions.forEach((dimension) => {
            const { column } = dimension
            const { tolerance } = column

            for (let i = 0; i < column.times.length; i++) {
                const year = column.times[i]
                const entityName = column.entityNames[i]
                if (
                    year < targetYear - tolerance ||
                    year > targetYear + tolerance ||
                    !selectedEntityNameSet.has(entityName)
                )
                    continue

                const currentDatum = dataByEntityName[entityName]
                // Make sure we use the closest value to the target year within tolerance (preferring later)
                if (
                    currentDatum &&
                    Math.abs(currentDatum.year - targetYear) <
                        Math.abs(year - targetYear)
                )
                    continue

                const datum = {
                    entityName,
                    value: +column.values[i],
                    year: year,
                    label: getLabelForEntityName(entityName),
                    color: "#2E5778",
                    formatValue: dimension.column.formatValueShort,
                }

                dataByEntityName[entityName] = datum
            }
        })

        if (this.grapher.isLineChart) {
            // If derived from line chart, use line chart colors
            for (const key in dataByEntityName) {
                const lineSeries = this.grapher.lineChartTransform.predomainData.find(
                    (series) => series.entityName === key
                )
                if (lineSeries) dataByEntityName[key].color = lineSeries.color
            }
        } else {
            const data = sortBy(Object.values(dataByEntityName), (d) => d.value)
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
                    getColorForEntityName(d.entityName) ||
                    colorByValue.get(d.value) ||
                    d.color
            })
        }

        if (this.isLogScale)
            this._filterDataForLogScaleInPlace(dataByEntityName)

        return orderBy(
            Object.values(dataByEntityName),
            ["value", "key"],
            ["desc", "asc"]
        )
    }

    private _filterDataForLogScaleInPlace(dataByEntityName: {
        [entityName: string]: DiscreteBarDatum
    }) {
        Object.keys(dataByEntityName).forEach((key) => {
            const datum = dataByEntityName[key]
            if (datum.value <= 0) delete dataByEntityName[key]
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

    @computed get allData() {
        if (!this.hasTimeline) {
            return this.currentData
        }

        const { grapher } = this
        const {
            selectedEntityNameSet,
            getColorForEntityName,
            getLabelForEntityName,
        } = grapher.table
        const filledDimensions = grapher.filledDimensions
        const allData: DiscreteBarDatum[] = []

        filledDimensions.forEach((dimension) => {
            const { column } = dimension

            for (let i = 0; i < column.times.length; i++) {
                const year = column.times[i]
                const entityName = column.entityNames[i]

                if (!selectedEntityNameSet.has(entityName)) continue

                const datum = {
                    entityName,
                    value: +column.values[i],
                    year,
                    label: getLabelForEntityName(entityName),
                    color: "#2E5778",
                    formatValue: dimension.column.formatValueShort,
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
                getColorForEntityName(d.entityName) ||
                colorByValue.get(d.value) ||
                d.color
        })

        return sortNumeric(data, (d) => d.value, SortOrder.desc)
    }
}
