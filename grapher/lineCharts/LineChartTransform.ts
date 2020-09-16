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
import {
    EntityDimensionKey,
    ScaleType,
    Time,
} from "grapher/core/GrapherConstants"
import { LineChartSeries } from "./LineChart"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { ChartTransform } from "grapher/chart/ChartTransform"
import { LineLabel } from "./LineLabels"
import { EntityName } from "owidTable/OwidTableConstants"
import { makeEntityDimensionKey } from "grapher/core/EntityDimensionKey"

// Responsible for translating chart configuration into the form
// of a line chart
export class LineChartTransform extends ChartTransform {
    @computed get failMessage() {
        const { filledDimensions } = this.grapher
        if (!filledDimensions.some((d) => d.property === "y"))
            return "Missing Y axis variable"
        else if (isEmpty(this.groupedData)) return "No matching data"
        else return undefined
    }

    // Filter the data so it fits within the domains
    @computed get groupedData() {
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

    @computed private get allValues() {
        return flatten(this.predomainData.map((series) => series.values))
    }

    @computed private get filteredValues() {
        return flatten(this.groupedData.map((series) => series.values))
    }

    @computed private get annotationsMap() {
        return this.grapher.primaryDimensions[0].column.annotationsColumn
            ?.entityNameMap
    }

    @computed private get colorScheme() {
        const colorScheme = ColorSchemes[this.grapher.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["owid-distinct"] as ColorScheme)
    }

    @computed private get initialData() {
        const {
            selectedKeys,
            selectedKeysByKey,
            filledDimensions,
            yAxis,
        } = this.grapher

        let chartData: LineChartSeries[] = []

        filledDimensions.forEach((dimension, dimIndex) => {
            const seriesByKey = new Map<EntityDimensionKey, LineChartSeries>()

            for (let i = 0; i < dimension.column.times.length; i++) {
                const year = dimension.column.times[i]
                const value = parseFloat(dimension.values[i] as string)
                const entityName = dimension.column.entityNames[i]
                const entityDimensionKey = makeEntityDimensionKey(
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
                        entityDimensionKey,
                        isProjection: dimension.isProjection,
                        color: "#000", // tmp
                    }
                    seriesByKey.set(entityDimensionKey, series)
                }

                series.values.push({ x: year, y: value, time: year })
            }

            chartData = chartData.concat([...Array.from(seriesByKey.values())])
        })

        this._addColorsToSeries(chartData)

        // Preserve the original ordering for render. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, (series) =>
            selectedKeys.indexOf(series.entityDimensionKey)
        )

        return chartData
    }

    private _addColorsToSeries(allSeries: LineChartSeries[]) {
        // Color from lowest to highest
        const sorted = sortBy(allSeries, (series) => last(series.values)!.y)

        const colors = this.colorScheme.getColors(sorted.length)
        if (this.grapher.invertColorScheme) colors.reverse()

        sorted.forEach((series, i) => {
            series.color =
                this.grapher.keyColors[series.entityDimensionKey] || colors[i]
        })
    }

    @computed get availableTimes(): Time[] {
        return flatten(this.initialData.map((g) => g.values.map((d) => d.x)))
    }

    @computed get predomainData() {
        if (!this.grapher.isRelativeMode) return this.initialData

        return cloneDeep(this.initialData).map((series) => {
            const startIndex = series.values.findIndex(
                (value) => value.time >= this.startTimelineTime && value.y !== 0
            )
            if (startIndex < 0) {
                series.values = []
                return series
            }

            const relativeValues = series.values.slice(startIndex)
            // Clone to avoid overwriting in next loop
            const indexValue = clone(relativeValues[0])
            series.values = relativeValues.map((value) => {
                value.y = (value.y - indexValue.y) / Math.abs(indexValue.y)
                return value
            })

            return series
        })
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
            toShow = toShow.filter((g) => g.isProjection)

        return toShow.map((series) => {
            const lastValue = last(series.values)!.y
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
        axis.updateDomainPreservingUserSettings([
            this.startTimelineTime,
            this.endTimelineTime,
        ])
        axis.scaleType = ScaleType.linear
        axis.scaleTypeOptions = [ScaleType.linear]
        axis.tickFormatFn = this.grapher.formatYearTickFunction
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yDomainDefault(): [number, number] {
        const yValues = (this.grapher.useTimelineDomains
            ? this.allValues
            : this.filteredValues
        ).map((v) => v.y)
        return [min(yValues) ?? 0, max(yValues) ?? 100]
    }

    @computed private get yDomain(): [number, number] {
        const { grapher, yDomainDefault } = this
        const domain = grapher.yAxis.domain
        return [
            Math.min(domain[0], yDomainDefault[0]),
            Math.max(domain[1], yDomainDefault[1]),
        ]
    }

    @computed private get yTickFormat() {
        if (this.grapher.isRelativeMode)
            return (v: number) =>
                (v > 0 ? "+" : "") + formatValue(v * 100, { unit: "%" })

        const yDimensionFirst = this.grapher.filledDimensions.find(
            (d) => d.property === "y"
        )

        return yDimensionFirst ? yDimensionFirst.formatValueShortFn : identity
    }

    @computed get yAxis() {
        const { grapher, yDomain, yTickFormat } = this
        const axis = grapher.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomain)
        if (grapher.isRelativeMode) axis.scaleTypeOptions = [ScaleType.linear]
        axis.hideFractionalTicks = this.allValues.every(
            (val) => val.y % 1 === 0
        ) // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.tickFormatFn = yTickFormat
        return axis
    }

    @computed get hasTimeline() {
        return this.timelineTimes.length > 1 && !this.grapher.hideTimeline
    }

    /**
     * Whether the plotted data only contains a single year.
     */
    @computed get isSingleTime() {
        return this.startTimelineTime === this.endTimelineTime
    }

    @computed get canToggleRelativeMode() {
        return !this.grapher.hideRelativeToggle && !this.isSingleTime
    }
}
