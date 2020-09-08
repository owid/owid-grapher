import { computed } from "mobx"
import {
    includes,
    identity,
    cloneDeep,
    find,
    sortBy,
    max,
    defaultTo,
    uniq,
    flatten,
} from "grapher/utils/Util"
import { StackedBarValue, StackedBarSeries } from "./StackedBarChart"
import { ChartTransform } from "grapher/chart/ChartTransform"
import { ChartDimension } from "grapher/chart/ChartDimension"
import { EntityDimensionKey } from "grapher/core/GrapherConstants"
import { Time } from "grapher/utils/TimeBounds"
import { ColorScale } from "grapher/color/ColorScale"

// Responsible for translating chart configuration into the form
// of a discrete bar chart
export class StackedBarTransform extends ChartTransform {
    @computed get failMessage(): string | undefined {
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

    @computed get primaryDimension(): ChartDimension | undefined {
        return find(this.grapher.filledDimensions, (d) => d.property === "y")
    }
    @computed get colorDimension(): ChartDimension | undefined {
        return find(
            this.grapher.filledDimensions,
            (d) => d.property === "color"
        )
    }

    @computed get availableYears(): Time[] {
        if (this.primaryDimension === undefined) return []
        return this.primaryDimension.yearsUniq
    }

    @computed get barValueFormat(): (datum: StackedBarValue) => string {
        return (datum: StackedBarValue) => {
            return datum.y.toString()
        }
    }

    @computed get tickFormat(): (d: number) => string {
        const { primaryDimension } = this
        return primaryDimension
            ? primaryDimension.formatValueShort
            : (d: number) => `${d}`
    }

    @computed get yFormatTooltip(): (d: number) => string {
        const { primaryDimension, yTickFormat } = this

        return primaryDimension ? primaryDimension.formatValueLong : yTickFormat
    }

    // @computed get xFormatTooltip(): (d: number) => string {
    //     return !this.xDimension ? this.xAxis.tickFormat : this.xDimension.formatValueLong
    // }

    @computed get xDomainDefault(): [number, number] {
        return [this.startYear, this.endYear]
    }

    // TODO: Make XAxis generic
    @computed get xAxis() {
        const { grapher, xDomainDefault } = this
        const axis = grapher.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(xDomainDefault)
        if (this.grapher.formatYearFunction)
            axis.tickFormat = this.grapher.formatYearFunction as any
        axis.hideGridlines = true
        axis.hideFractionalTicks = true
        return axis
    }

    @computed get yDomainDefault(): [number, number] {
        const lastSeries = this.stackedData[this.stackedData.length - 1]

        const yValues = lastSeries.values.map((d) => d.yOffset + d.y)
        return [0, defaultTo(max(yValues), 100)]
    }

    @computed get yDimensionFirst() {
        return find(this.grapher.filledDimensions, (d) => d.property === "y")
    }

    @computed get yTickFormat() {
        const { yDimensionFirst } = this

        return yDimensionFirst ? yDimensionFirst.formatValueShort : identity
    }

    @computed get yAxis() {
        const { grapher, yDomainDefault, yTickFormat } = this
        const axis = grapher.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomainDefault)
        axis.domain = [yDomainDefault[0], yDomainDefault[1]] // Stacked chart must have its own y domain
        axis.tickFormat = yTickFormat
        return axis
    }

    @computed get allStackedValues(): StackedBarValue[] {
        return flatten(this.stackedData.map((series) => series.values))
    }

    @computed get xValues(): number[] {
        return uniq(this.allStackedValues.map((bar) => bar.x))
    }

    @computed get groupedData(): StackedBarSeries[] {
        const { grapher, timelineYears } = this
        const { selectedKeys, selectedKeysByKey } = grapher
        const filledDimensions = grapher.filledDimensions

        let groupedData: StackedBarSeries[] = []

        filledDimensions.forEach((dimension, dimIndex) => {
            const seriesByKey = new Map<EntityDimensionKey, StackedBarSeries>()

            for (let i = 0; i <= dimension.years.length; i += 1) {
                const year = dimension.years[i]
                const entityName = dimension.entityNames[i]
                const value = +dimension.values[i]
                const entityDimensionKey = grapher.makeEntityDimensionKey(
                    entityName,
                    dimIndex
                )
                let series = seriesByKey.get(entityDimensionKey)

                // Not a selected key, don't add any data for it
                if (!selectedKeysByKey[entityDimensionKey]) continue
                // Must be numeric
                if (isNaN(value)) continue
                // Stacked bar chart can't go negative!
                if (value < 0) continue
                // only consider years that are part of timeline to line up the bars
                if (!includes(timelineYears, year)) continue

                if (!series) {
                    series = {
                        entityDimensionKey: entityDimensionKey,
                        label: grapher.getLabelForKey(entityDimensionKey),
                        values: [],
                        color: "#fff", // Temp
                    }
                    seriesByKey.set(entityDimensionKey, series)
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

            while (i < timelineYears.length) {
                const value = series.values[i] as StackedBarValue | undefined
                const expectedYear = timelineYears[i]

                if (value === undefined || value.x > timelineYears[i]) {
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
            (series) => -selectedKeys.indexOf(series.entityDimensionKey)
        )

        return groupedData
    }

    @computed get colorScale(): ColorScale {
        const that = this
        return new ColorScale({
            get config() {
                return that.grapher.colorScale
            },
            get defaultBaseColorScheme() {
                return "stackedAreaDefault"
            },
            get sortedNumericValues() {
                return that.colorDimension?.sortedNumericValues ?? []
            },
            get categoricalValues() {
                return uniq(
                    that.groupedData.map((d) => d.entityDimensionKey)
                ).reverse()
            },
            get hasNoDataBin() {
                return false
            },
            get formatNumericValue() {
                return that.colorDimension?.formatValueShort ?? identity
            },
            get formatCategoricalValue() {
                return (key: EntityDimensionKey) =>
                    that.grapher.getLabelForKey(key)
            },
        })
    }

    // Apply time filtering and stacking
    @computed get stackedData(): StackedBarSeries[] {
        const { groupedData, startYear, endYear } = this

        const stackedData = cloneDeep(groupedData)

        for (const series of stackedData) {
            series.color =
                this.colorScale.getColor(series.entityDimensionKey) ?? "#ddd"
            series.values = series.values.filter(
                (v) => v.x >= startYear && v.x <= endYear
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
