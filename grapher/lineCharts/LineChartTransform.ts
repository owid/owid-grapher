import { computed } from "mobx"
import {
    min,
    max,
    isEmpty,
    sortBy,
    identity,
    cloneDeep,
    clone,
    formatValue,
    flatten,
    last,
} from "grapher/utils/Util"
import { EntityDimensionKey, ScaleType } from "grapher/core/GrapherConstants"
import { LineChartSeries, LineChartValue } from "./LineChart"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { ChartTransform } from "grapher/chart/ChartTransform"
import { ChartDimension } from "grapher/chart/ChartDimension"
import { Time } from "grapher/utils/TimeBounds"
import { LineLabel } from "./LineLabels"
import { EntityName } from "owidTable/OwidTable"

// Responsible for translating chart configuration into the form
// of a line chart
export class LineChartTransform extends ChartTransform {
    @computed get failMessage(): string | undefined {
        const { filledDimensions } = this.grapher
        if (!filledDimensions.some((d) => d.property === "y"))
            return "Missing Y axis variable"
        else if (isEmpty(this.groupedData)) return "No matching data"
        else return undefined
    }

    @computed get colorScheme(): ColorScheme {
        const colorScheme = ColorSchemes[this.grapher.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["owid-distinct"] as ColorScheme)
    }

    @computed get initialData(): LineChartSeries[] {
        const { grapher } = this
        const { yAxis } = grapher
        const { selectedKeys, selectedKeysByKey } = grapher
        const filledDimensions = grapher.filledDimensions

        let chartData: LineChartSeries[] = []

        filledDimensions.forEach((dimension, dimIndex) => {
            const seriesByKey = new Map<EntityDimensionKey, LineChartSeries>()

            for (let i = 0; i < dimension.years.length; i++) {
                const year = dimension.years[i]
                const value = parseFloat(dimension.values[i] as string)
                const entityName = dimension.entityNames[i]
                const entityDimensionKey = grapher.makeEntityDimensionKey(
                    entityName,
                    dimIndex
                )
                let series = seriesByKey.get(entityDimensionKey)

                // Not a selected key, don't add any data for it
                if (!selectedKeysByKey[entityDimensionKey]) continue
                // Can't have values <= 0 on log scale
                if (value <= 0 && yAxis.scaleType === ScaleType.log) continue

                if (!series) {
                    series = {
                        values: [],
                        entityName,
                        entityDimensionKey: entityDimensionKey,
                        isProjection: dimension.isProjection,
                        formatValue: dimension.formatValueLong,
                        color: "#000", // tmp
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
            (series) => series.values[series.values.length - 1].y
        )

        const colors = this.colorScheme.getColors(chartData.length)
        if (this.grapher.invertColorScheme) colors.reverse()
        chartData.forEach((series, i) => {
            series.color =
                grapher.keyColors[series.entityDimensionKey] || colors[i]
        })

        // Preserve the original ordering for render. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, (series) =>
            selectedKeys.indexOf(series.entityDimensionKey)
        )

        return chartData
    }

    @computed get availableYears(): Time[] {
        return flatten(this.initialData.map((g) => g.values.map((d) => d.x)))
    }

    @computed get predomainData() {
        if (!this.isRelativeMode) return this.initialData

        return cloneDeep(this.initialData).map((series) => {
            const startIndex = series.values.findIndex(
                (v) => v.time >= this.startYear && v.y !== 0
            )
            if (startIndex < 0) {
                series.values = []
                return series
            } else {
                const relativeValues = series.values.slice(startIndex)
                // Clone to avoid overwriting in next loop
                const indexValue = clone(relativeValues[0])
                series.values = relativeValues.map((v) => {
                    v.y = (v.y - indexValue.y) / Math.abs(indexValue.y)
                    return v
                })
            }
            return series
        })
    }

    @computed get allValues(): LineChartValue[] {
        return flatten(this.predomainData.map((series) => series.values))
    }

    @computed get filteredValues(): LineChartValue[] {
        return flatten(this.groupedData.map((series) => series.values))
    }

    @computed get annotationsMap() {
        return this.grapher.primaryDimensions[0].column.annotationsColumn
            ?.entityNameMap
    }

    getAnnotationsForSeries(entityName: EntityName) {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(entityName)
        return annos ? Array.from(annos.values()).join(" & ") : undefined
    }

    getLabelForKey(key: string) {
        return this.grapher.getLabelForKey(key)
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get legendItems(): LineLabel[] {
        // If there are any projections, ignore non-projection legends
        // Bit of a hack
        let toShow = this.groupedData
        if (toShow.some((g) => !!g.isProjection))
            toShow = this.groupedData.filter((g) => g.isProjection)

        return toShow.map((series) => {
            const lastValue = (last(series.values) as LineChartValue).y
            return {
                color: series.color,
                entityDimensionKey: series.entityDimensionKey,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.grapher.hideLegend
                    ? ""
                    : `${this.getLabelForKey(series.entityDimensionKey)}`,
                annotation: this.getAnnotationsForSeries(series.entityName),
                yValue: lastValue,
            }
        })
    }

    @computed get xAxis() {
        const axis = this.grapher.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings([this.startYear, this.endYear])
        axis.scaleType = ScaleType.linear
        axis.scaleTypeOptions = [ScaleType.linear]
        axis.tickFormat = this.grapher.formatYearTickFunction
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yDimensionFirst(): ChartDimension | undefined {
        return this.grapher.filledDimensions.find((d) => d.property === "y")
    }

    @computed private get yDomainDefault(): [number, number] {
        const yValues = (this.grapher.useTimelineDomains
            ? this.allValues
            : this.filteredValues
        ).map((v) => v.y)
        return [min(yValues) ?? 0, max(yValues) ?? 100]
    }

    @computed get yDomain(): [number, number] {
        const { grapher, yDomainDefault } = this
        const domain = grapher.yAxis.domain
        return [
            Math.min(domain[0], yDomainDefault[0]),
            Math.max(domain[1], yDomainDefault[1]),
        ]
    }

    @computed get yScaleType() {
        return this.isRelativeMode
            ? ScaleType.linear
            : this.grapher.yAxis.scaleType
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

    @computed get yAxis() {
        const { grapher, yDomain, yTickFormat, isRelativeMode } = this
        const axis = grapher.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomain)
        if (isRelativeMode) axis.scaleTypeOptions = [ScaleType.linear]
        axis.hideFractionalTicks = this.allValues.every(
            (val) => val.y % 1 === 0
        ) // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.tickFormat = yTickFormat
        return axis
    }

    @computed get canToggleRelativeMode(): boolean {
        return !this.grapher.hideRelativeToggle && !this.isSingleYear
    }

    // Filter the data so it fits within the domains
    @computed get groupedData(): LineChartSeries[] {
        const { xAxis } = this
        const groupedData = cloneDeep(this.predomainData)

        for (const g of groupedData) {
            // The values can include non-numerical values, so we need to filter with isNaN()
            g.values = g.values.filter(
                (d) =>
                    d.x >= xAxis.domain[0] &&
                    d.x <= xAxis.domain[1] &&
                    !isNaN(d.y)
            )
        }

        return groupedData.filter((g) => g.values.length > 0)
    }
}
