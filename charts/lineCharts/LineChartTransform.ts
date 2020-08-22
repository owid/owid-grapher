import { computed } from "mobx"
import {
    some,
    min,
    max,
    isEmpty,
    sortBy,
    identity,
    cloneDeep,
    clone,
    defaultTo,
    formatValue,
    flatten,
    findIndex
} from "charts/Util"
import { EntityDimensionKey } from "charts/ChartConstants"
import { LineChartSeries, LineChartValue } from "./LineChart"
import { AxisSpec } from "charts/AxisSpec"
import { ColorSchemes, ColorScheme } from "charts/color/ColorSchemes"
import { ChartTransform } from "charts/ChartTransform"
import { ChartDimension } from "charts/ChartDimension"
import { Time } from "charts/TimeBounds"

// Responsible for translating chart configuration into the form
// of a line chart
export class LineChartTransform extends ChartTransform {
    @computed get isValidConfig(): boolean {
        return this.hasYDimension
    }

    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.chart
        if (!some(filledDimensions, d => d.property === "y"))
            return "Missing Y axis variable"
        else if (isEmpty(this.groupedData)) return "No matching data"
        else return undefined
    }

    @computed get colorScheme(): ColorScheme {
        const colorScheme =
            ColorSchemes[this.chart.props.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["owid-distinct"] as ColorScheme)
    }

    @computed get initialData(): LineChartSeries[] {
        const { chart } = this
        const { yAxis } = chart
        const { selectedKeys, selectedKeysByKey } = chart.data
        const filledDimensions = chart.filledDimensions

        let chartData: LineChartSeries[] = []

        filledDimensions.forEach((dimension, dimIndex) => {
            const seriesByKey = new Map<EntityDimensionKey, LineChartSeries>()

            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const value = parseFloat(dimension.values[i] as string)
                const entityName = dimension.entityNames[i]
                const entityDimensionKey = chart.data.makeEntityDimensionKey(
                    entityName,
                    dimIndex
                )
                let series = seriesByKey.get(entityDimensionKey)

                // Not a selected key, don't add any data for it
                if (!selectedKeysByKey[entityDimensionKey]) continue
                // Can't have values <= 0 on log scale
                if (value <= 0 && yAxis.scaleType === "log") continue

                if (!series) {
                    series = {
                        values: [],
                        entityName,
                        entityDimensionKey: entityDimensionKey,
                        isProjection: dimension.isProjection,
                        formatValue: dimension.formatValueLong,
                        color: "#000" // tmp
                    }
                    seriesByKey.set(entityDimensionKey, series)
                }

                series.values.push({ x: year, y: value, time: year })
            }

            chartData = chartData.concat([...Array.from(seriesByKey.values())])
        })

        // Color from lowest to highest
        chartData = sortBy(
            chartData,
            series => series.values[series.values.length - 1].y
        )

        const colors = this.colorScheme.getColors(chartData.length)
        if (this.chart.props.invertColorScheme) colors.reverse()
        chartData.forEach((series, i) => {
            series.color =
                chart.data.keyColors[series.entityDimensionKey] || colors[i]
        })

        // Preserve the original ordering for render. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, series =>
            selectedKeys.indexOf(series.entityDimensionKey)
        )

        return chartData
    }

    @computed get availableYears(): Time[] {
        return flatten(this.initialData.map(g => g.values.map(d => d.x)))
    }

    @computed get predomainData() {
        if (!this.isRelativeMode) return this.initialData

        return cloneDeep(this.initialData).map(series => {
            const startIndex = findIndex(
                series.values,
                v => v.time >= this.startYear && v.y !== 0
            )
            if (startIndex < 0) {
                series.values = []
                return series
            } else {
                const relativeValues = series.values.slice(startIndex)
                // Clone to avoid overwriting in next loop
                const indexValue = clone(relativeValues[0])
                series.values = relativeValues.map(v => {
                    v.y = (v.y - indexValue.y) / Math.abs(indexValue.y)
                    return v
                })
            }
            return series
        })
    }

    @computed get allValues(): LineChartValue[] {
        return flatten(this.predomainData.map(series => series.values))
    }

    @computed get filteredValues(): LineChartValue[] {
        return flatten(this.groupedData.map(series => series.values))
    }

    @computed get xDomain(): [number, number] {
        return [this.startYear, this.endYear]
    }

    @computed get xAxis(): AxisSpec {
        const { xDomain } = this
        return {
            label: this.chart.xAxis.label || "",
            tickFormat: this.chart.formatYearTickFunction,
            domain: xDomain,
            scaleType: "linear",
            scaleTypeOptions: ["linear"],
            hideFractionalTicks: true,
            hideGridlines: true
        }
    }

    @computed get yDimensionFirst(): ChartDimension | undefined {
        return this.chart.filledDimensions.find(d => d.property === "y")
    }

    @computed get yDomainDefault(): [number, number] {
        const yValues = (this.chart.useTimelineDomains
            ? this.allValues
            : this.filteredValues
        ).map(v => v.y)
        return [defaultTo(min(yValues), 0), defaultTo(max(yValues), 100)]
    }

    @computed get yDomain(): [number, number] {
        const { chart, yDomainDefault } = this
        return [
            Math.min(
                defaultTo(chart.yAxis.domain[0], Infinity),
                yDomainDefault[0]
            ),
            Math.max(
                defaultTo(chart.yAxis.domain[1], -Infinity),
                yDomainDefault[1]
            )
        ]
    }

    @computed get yScaleType() {
        return this.isRelativeMode ? "linear" : this.chart.yAxis.scaleType
    }

    @computed get yTickFormat() {
        if (this.isRelativeMode) {
            return (v: number) =>
                (v > 0 ? "+" : "") + formatValue(v * 100, { unit: "%" })
        } else {
            return this.yDimensionFirst
                ? this.yDimensionFirst.formatValueShort
                : identity
        }
    }

    @computed get yAxisHideFractionalTicks(): boolean {
        // all y axis points are integral, don't show fractional ticks in that case
        return this.allValues.every(val => val.y % 1 === 0)
    }

    @computed get yAxis(): AxisSpec {
        const { chart, yDomain, yScaleType, yTickFormat, isRelativeMode } = this
        return {
            label: "",
            tickFormat: yTickFormat,
            domain: yDomain,
            scaleType: yScaleType,
            scaleTypeOptions: isRelativeMode
                ? ["linear"]
                : chart.yAxis.scaleTypeOptions,
            hideFractionalTicks: this.yAxisHideFractionalTicks
        }
    }

    @computed get isRelativeMode(): boolean {
        return this.chart.props.stackMode === "relative"
    }

    @computed get canToggleRelative(): boolean {
        return !this.chart.props.hideRelativeToggle && !this.isSingleYear
    }

    // Filter the data so it fits within the domains
    @computed get groupedData(): LineChartSeries[] {
        const { xAxis } = this
        const groupedData = cloneDeep(this.predomainData)

        for (const g of groupedData) {
            // The values can include non-numerical values, so we need to filter with isNaN()
            g.values = g.values.filter(
                d =>
                    d.x >= xAxis.domain[0] &&
                    d.x <= xAxis.domain[1] &&
                    !isNaN(d.y)
            )
        }

        return groupedData.filter(g => g.values.length > 0)
    }
}
