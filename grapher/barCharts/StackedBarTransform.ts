import { computed } from "mobx"
import {
    cloneDeep,
    sortBy,
    max,
    defaultTo,
    uniq,
    flatten,
} from "grapher/utils/Util"
import { StackedBarValue, StackedBarSeries } from "./StackedBarChart"
import { ChartTransform } from "grapher/chart/ChartTransform"
import { Time } from "grapher/core/GrapherConstants"
import { ColorScale } from "grapher/color/ColorScale"
import { EntityName } from "owidTable/OwidTableConstants"

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export class StackedBarTransform extends ChartTransform {
    @computed get failMessage() {
        const { filledDimensions } = this.grapher
        if (!filledDimensions.some((d) => d.property === "y"))
            return "Missing variable"
        else if (
            this.groupedData.length === 0 ||
            this.groupedData[0].values.length === 0
        )
            return "No matching data"
        else return undefined
    }

    @computed get primaryDimension() {
        return this.grapher.filledDimensions.find((d) => d.property === "y")
    }
    @computed get colorDimension() {
        return this.grapher.filledDimensions.find((d) => d.property === "color")
    }

    @computed get availableTimes(): Time[] {
        if (this.primaryDimension === undefined) return []
        return this.primaryDimension.column.timesUniq
    }

    @computed get barValueFormat(): (datum: StackedBarValue) => string {
        return (datum: StackedBarValue) => datum.y.toString()
    }

    @computed get tickFormatFn(): (d: number) => string {
        const { primaryDimension } = this
        return primaryDimension
            ? primaryDimension.column.formatValueShort
            : (d: number) => `${d}`
    }

    @computed get xDomainDefault(): [number, number] {
        return [this.startTimelineTime, this.endTimelineTime]
    }

    // TODO: Make XAxis generic
    @computed get horizontalAxis() {
        const { grapher, xDomainDefault } = this
        const axis = grapher.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(xDomainDefault)
        axis.column = this.grapher.table.timeColumn
        axis.hideGridlines = true
        axis.hideFractionalTicks = true
        return axis
    }

    @computed get yDomainDefault(): [number, number] {
        const lastSeries = this.stackedData[this.stackedData.length - 1]

        const yValues = lastSeries.values.map((d) => d.yOffset + d.y)
        return [0, defaultTo(max(yValues), 100)]
    }

    @computed get verticalAxis() {
        const { grapher, yDomainDefault } = this
        const axis = grapher.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomainDefault)
        axis.domain = [yDomainDefault[0], yDomainDefault[1]] // Stacked chart must have its own y domain
        axis.column = this.grapher.yColumns[0]
        return axis
    }

    @computed get allStackedValues() {
        return flatten(this.stackedData.map((series) => series.values))
    }

    @computed get xValues() {
        return uniq(this.allStackedValues.map((bar) => bar.x))
    }

    @computed get groupedData() {
        const { grapher, timelineTimes } = this
        const { table } = grapher
        const {
            selectedEntityNameSet,
            selectedEntityNames,
            getLabelForEntityName,
        } = table
        const filledDimensions = grapher.filledDimensions

        let groupedData: StackedBarSeries[] = []

        filledDimensions.forEach((dimension) => {
            const seriesByKey = new Map<EntityName, StackedBarSeries>()

            const { column } = dimension

            for (let i = 0; i <= column.times.length; i += 1) {
                const year = column.times[i]
                const entityName = column.entityNames[i]
                const value = +column.values[i]
                let series = seriesByKey.get(entityName)

                // Not a selected key, don't add any data for it
                if (!selectedEntityNameSet.has(entityName)) continue
                // Must be numeric
                if (isNaN(value)) continue
                // Stacked bar chart can't go negative!
                if (value < 0) continue
                // only consider years that are part of timeline to line up the bars
                if (!timelineTimes.includes(year)) continue

                if (!series) {
                    series = {
                        entityName,
                        label: getLabelForEntityName(entityName),
                        values: [],
                        color: "#fff", // Temp
                    }
                    seriesByKey.set(entityName, series)
                }
                series.values.push({
                    x: year,
                    y: value,
                    yOffset: 0,
                    isFake: false,
                    label: series.label,
                })
            }

            groupedData = groupedData.concat([
                ...Array.from(seriesByKey.values()),
            ])
        })

        // Now ensure that every series has a value entry for every year in the data
        groupedData.forEach((series) => {
            let i = 0

            while (i < timelineTimes.length) {
                const value = series.values[i] as StackedBarValue | undefined
                const expectedYear = timelineTimes[i]

                if (value === undefined || value.x > timelineTimes[i]) {
                    // console.log("series " + series.key + " needs fake bar for " + expectedYear)

                    const fakeY = 0
                    series.values.splice(i, 0, {
                        x: expectedYear,
                        y: fakeY,
                        yOffset: 0,
                        isFake: true,
                        label: series.label,
                    })
                }
                i += 1
            }
        })

        // Preserve order
        groupedData = sortBy(
            groupedData,
            (series) => -selectedEntityNames.indexOf(series.entityName)
        )

        return groupedData
    }

    @computed get colorScale() {
        const that = this
        const colorColumn = this.colorDimension?.column
        return new ColorScale({
            get config() {
                return that.grapher.colorScale
            },
            defaultBaseColorScheme: "stackedAreaDefault",
            get categoricalValues() {
                return uniq(that.groupedData.map((d) => d.entityName)).reverse()
            },
            hasNoDataBin: false,
        })
    }

    // Apply time filtering and stacking
    @computed get stackedData() {
        const { groupedData, startTimelineTime, endTimelineTime } = this

        const stackedData = cloneDeep(groupedData)

        for (const series of stackedData) {
            series.color = this.colorScale.getColor(series.entityName) ?? "#ddd"
            series.values = series.values.filter(
                (v) => v.x >= startTimelineTime && v.x <= endTimelineTime
            )
        }

        // every subsequent series needs be stacked on top of previous series
        for (let i = 1; i < stackedData.length; i++) {
            for (let j = 0; j < stackedData[0].values.length; j++) {
                stackedData[i].values[j].yOffset =
                    stackedData[i - 1].values[j].y +
                    stackedData[i - 1].values[j].yOffset
            }
        }

        // if the total height of any stacked column is 0, remove it
        const keyIndicesToRemove: number[] = []
        const lastSeries = stackedData[stackedData.length - 1]
        lastSeries.values.forEach((bar, index) => {
            if (bar.yOffset + bar.y === 0) {
                keyIndicesToRemove.push(index)
            }
        })
        for (let i = keyIndicesToRemove.length - 1; i >= 0; i--) {
            stackedData.forEach((series) => {
                series.values.splice(keyIndicesToRemove[i], 1)
            })
        }

        return stackedData
    }
}
