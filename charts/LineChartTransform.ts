import { computed } from "mobx"
import {
    some,
    min,
    max,
    isEmpty,
    sortBy,
    identity,
    cloneDeep,
    sortedUniq,
    clone,
    defaultTo,
    formatValue
} from "./Util"
import { EntityDimensionKey } from "./EntityDimensionKey"
import { LineChartSeries, LineChartValue } from "./LineChart"
import { AxisSpec } from "./AxisSpec"
import { ColorSchemes, ColorScheme } from "./ColorSchemes"
import { ChartTransform } from "./ChartTransform"
import { DimensionWithData } from "./DimensionWithData"
import { findIndex } from "./Util"
import { Time } from "./TimeBounds"

// Responsible for translating chart configuration into the form
// of a line chart
export class LineChartTransform extends ChartTransform {
    @computed get isValidConfig(): boolean {
        return this.chart.dimensions.some(d => d.property === "y")
    }

    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.chart.data
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
        const { filledDimensions, selectedKeys, selectedKeysByKey } = chart.data

        let chartData: LineChartSeries[] = []

        filledDimensions.forEach((dimension, dimIndex) => {
            const seriesByKey = new Map<EntityDimensionKey, LineChartSeries>()

            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const value = parseFloat(dimension.values[i] as string)
                const entity = dimension.entities[i]
                const entityDimensionKey = chart.data.makeEntityDimensionKey(
                    entity,
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
                        key: entityDimensionKey,
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
            series.color = chart.data.keyColors[series.key] || colors[i]
        })

        // Preserve the original ordering for render. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, series =>
            selectedKeys.indexOf(series.key)
        )

        return chartData
    }

    @computed get timelineYears(): Time[] {
        const allYears: Time[] = []
        this.initialData.forEach(g => allYears.push(...g.values.map(d => d.x)))
        return sortedUniq(sortBy(allYears))
    }

    @computed get predomainData() {
        if (this.isRelativeMode) {
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
        } else {
            return this.initialData
        }
    }

    @computed get allValues(): LineChartValue[] {
        const allValues: LineChartValue[] = []
        this.predomainData.forEach(series => allValues.push(...series.values))
        return allValues
    }

    @computed get filteredValues(): LineChartValue[] {
        const allValues: LineChartValue[] = []
        this.groupedData.forEach(series => allValues.push(...series.values))
        return allValues
    }

    @computed get xDomain(): [number, number] {
        return [this.startYear, this.endYear]
    }

    @computed get xAxis(): AxisSpec {
        const { xDomain } = this
        return {
            label: this.chart.xAxis.label || "",
            tickFormat: this.chart.formatYearFunction,
            domain: xDomain,
            scaleType: "linear",
            scaleTypeOptions: ["linear"],
            hideFractionalTicks: true,
            hideGridlines: true
        }
    }

    @computed get yDimensionFirst(): DimensionWithData | undefined {
        return this.chart.data.filledDimensions.find(d => d.property === "y")
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

    @computed get yAxis(): AxisSpec {
        const { chart, yDomain, yScaleType, yTickFormat, isRelativeMode } = this
        return {
            label: "",
            tickFormat: yTickFormat,
            domain: yDomain,
            scaleType: yScaleType,
            scaleTypeOptions: isRelativeMode
                ? ["linear"]
                : chart.yAxis.scaleTypeOptions
        }
    }

    @computed get hasTimeline(): boolean {
        return (
            this.minTimelineYear !== this.maxTimelineYear &&
            !this.chart.props.hideTimeline
        )
    }

    @computed get isRelativeMode(): boolean {
        return this.chart.props.stackMode === "relative"
    }

    @computed get canToggleRelative(): boolean {
        return this.hasTimeline && !this.chart.props.hideRelativeToggle
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
