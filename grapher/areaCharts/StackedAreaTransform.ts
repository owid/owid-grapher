import { computed } from "mobx"
import { scaleOrdinal } from "d3-scale"
import {
    sortBy,
    cloneDeep,
    sum,
    identity,
    flatten,
    sortNumeric,
    uniq,
    max,
    formatValue,
} from "grapher/utils/Util"
import { EntityDimensionKey, Time } from "grapher/core/GrapherConstants"
import { StackedAreaSeries, StackedAreaValue } from "./StackedAreaChart"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { ChartTransform } from "grapher/chart/ChartTransform"

// Responsible for translating chart configuration into the form
// of a stacked area chart
export class StackedAreaTransform extends ChartTransform {
    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.grapher
        if (!filledDimensions.some((d) => d.property === "y"))
            return "Missing Y axis variable"
        else if (
            this.groupedData.length === 0 ||
            this.groupedData[0].values.length === 0
        )
            return "No matching data"
        else return undefined
    }

    // Get the data for each stacked area series, cleaned to ensure every series
    // "lines up" i.e. has a data point for every year
    @computed private get groupedData(): StackedAreaSeries[] {
        const { grapher } = this
        const { selectedKeys, selectedKeysByKey } = grapher
        const filledDimensions = grapher.filledDimensions

        let groupedData: StackedAreaSeries[] = []

        // First, we populate the data as we would for a line chart (each series independently)
        filledDimensions.forEach((dimension, dimIndex) => {
            const seriesByKey = new Map<EntityDimensionKey, StackedAreaSeries>()

            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const value = +dimension.values[i]
                const entityName = dimension.entityNames[i]
                const entityDimensionKey = grapher.makeEntityDimensionKey(
                    entityName,
                    dimIndex
                )
                let series = seriesByKey.get(entityDimensionKey)

                // Not a selected key, don't add any data for it
                if (!selectedKeysByKey[entityDimensionKey]) continue
                // Must be numeric
                if (isNaN(value)) continue
                // Stacked area chart can't go negative!
                if (value < 0) continue

                if (!series) {
                    series = {
                        values: [],
                        entityDimensionKey: entityDimensionKey,
                        isProjection: dimension.isProjection,
                        color: "#fff", // tmp
                    }
                    seriesByKey.set(entityDimensionKey, series)
                }

                series.values.push({ x: year, y: value, time: year })
            }

            groupedData = groupedData.concat([
                ...Array.from(seriesByKey.values()),
            ])
        })

        // Now ensure that every series has a value entry for every year in the data
        let allYears: number[] = []
        groupedData.forEach((series) =>
            allYears.push(...series.values.map((d) => d.x))
        )
        allYears = sortNumeric(uniq(allYears))

        groupedData.forEach((series) => {
            let i = 0
            let isBeforeStart = true

            while (i < allYears.length) {
                const value = series.values[i] as StackedAreaValue | undefined
                const expectedYear = allYears[i]

                if (value === undefined || value.x > allYears[i]) {
                    let fakeY = NaN

                    if (!isBeforeStart && i < series.values.length) {
                        // Missing data in the middle-- interpolate a value
                        const prevValue = series.values[i - 1]
                        const nextValue = series.values[i]
                        fakeY = (nextValue.y + prevValue.y) / 2
                    }

                    series.values.splice(i, 0, {
                        x: expectedYear,
                        y: fakeY,
                        time: expectedYear,
                        isFake: true,
                    })
                } else {
                    isBeforeStart = false
                }
                i += 1
            }
        })

        // Strip years at start and end where we couldn't successfully interpolate
        for (const firstSeries of groupedData.slice(0, 1)) {
            for (let i = firstSeries.values.length - 1; i >= 0; i--) {
                if (groupedData.some((series) => isNaN(series.values[i].y))) {
                    for (const series of groupedData) {
                        series.values.splice(i, 1)
                    }
                }
            }
        }

        // Preserve order
        groupedData = sortBy(
            groupedData,
            (series) => -selectedKeys.indexOf(series.entityDimensionKey)
        )

        // Assign colors
        const baseColors = this.colorScheme.getColors(groupedData.length)
        if (grapher.invertColorScheme) baseColors.reverse()
        const colorScale = scaleOrdinal(baseColors)
        groupedData.forEach((series) => {
            series.color =
                grapher.keyColors[series.entityDimensionKey] ||
                colorScale(series.entityDimensionKey)
        })

        // In relative mode, transform data to be a percentage of the total for that year
        if (this.isRelativeMode) {
            if (groupedData.length === 0) return []

            for (let i = 0; i < groupedData[0].values.length; i++) {
                const total = sum(
                    groupedData.map((series) => series.values[i].y)
                )
                for (let j = 0; j < groupedData.length; j++) {
                    groupedData[j].values[i].y =
                        total === 0
                            ? 0
                            : (groupedData[j].values[i].y / total) * 100
                }
            }
        }

        return groupedData
    }

    @computed get xAxis() {
        const { xDomainDefault } = this
        const grapher = this.grapher
        const axis = grapher.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(xDomainDefault)
        axis.tickFormatFn = this.grapher.table.timeColumnFormatFunction
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yDomainDefault(): [number, number] {
        const yValues = this.allStackedValues.map((d) => d.y)
        return [0, max(yValues) ?? 100]
    }

    @computed get yAxis() {
        const { isRelativeMode, yDimensionFirst } = this
        const { grapher, yDomainDefault } = this

        const axis = grapher.yAxis.toVerticalAxis()
        if (isRelativeMode) axis.domain = [0, 100]
        else
            axis.updateDomainPreservingUserSettings([
                yDomainDefault[0],
                yDomainDefault[1],
            ]) // Stacked area chart must have its own y domain)

        axis.tickFormatFn = isRelativeMode
            ? (v: number) => formatValue(v, { unit: "%" })
            : yDimensionFirst
            ? yDimensionFirst.formatValueShortFn
            : identity
        return axis
    }

    @computed get availableTimes(): Time[] {
        // Since we've already aligned the data, the years of any series corresponds to the years of all of them
        return this.groupedData[0].values.map((v) => v.x)
    }

    @computed get canToggleRelativeMode(): boolean {
        return !this.grapher.hideRelativeToggle
    }

    @computed private get colorScheme() {
        //return ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"]
        const colorScheme = ColorSchemes[this.grapher.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["stackedAreaDefault"] as ColorScheme)
    }

    @computed get xDomainDefault(): [number, number] {
        return [this.startTime, this.endTime]
    }

    // Apply time filtering and stacking
    @computed get stackedData(): StackedAreaSeries[] {
        const { groupedData, startTime, endTime } = this

        if (
            groupedData.some(
                (series) =>
                    series.values.length !== groupedData[0].values.length
            )
        )
            throw new Error(
                `Unexpected variation in stacked area chart series: ${groupedData.map(
                    (series) => series.values.length
                )}`
            )

        const stackedData = cloneDeep(groupedData)

        for (const series of stackedData) {
            series.values = series.values.filter(
                (v) => v.x >= startTime && v.x <= endTime
            )
            for (const value of series.values) {
                value.origY = value.y
            }
        }

        for (let i = 1; i < stackedData.length; i++) {
            for (let j = 0; j < stackedData[0].values.length; j++) {
                stackedData[i].values[j].y += stackedData[i - 1].values[j].y
            }
        }

        return stackedData
    }

    @computed get allStackedValues(): StackedAreaValue[] {
        return flatten(this.stackedData.map((series) => series.values))
    }

    @computed get yDimensionFirst() {
        return this.grapher.filledDimensions.find((d) => d.property === "y")
    }

    formatYTick(v: number) {
        if (this.isRelativeMode) return formatValue(v, { unit: "%" })

        const tickFormat = this.yDimensionFirst
            ? this.yDimensionFirst.formatValueShortFn
            : identity
        return tickFormat(v, { noTrailingZeroes: false })
    }
}
