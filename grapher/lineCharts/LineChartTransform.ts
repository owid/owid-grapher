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
import { ScaleType, Time } from "grapher/core/GrapherConstants"
import { LineChartSeries } from "./LineChart"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { ChartTransform } from "grapher/chart/ChartTransform"
import { LineLabel } from "./LineLabels"
import { EntityName } from "owidTable/OwidTableConstants"

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
        const { horizontalAxis } = this
        const groupedData = cloneDeep(this.predomainData)

        for (const g of groupedData) {
            // The values can include non-numerical values, so we need to filter with isNaN()
            g.values = g.values.filter(
                (d) =>
                    d.x >= horizontalAxis.domain[0] &&
                    d.x <= horizontalAxis.domain[1] &&
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
        return this.grapher.yColumns[0].annotationsColumn?.entityNameMap
    }

    @computed private get colorScheme() {
        const colorScheme = ColorSchemes[this.grapher.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["owid-distinct"] as ColorScheme)
    }

    @computed private get initialData() {
        const { filledDimensions, yAxis, table } = this.grapher

        const { selectedEntityNameSet, selectedEntityNames } = table

        let chartData: LineChartSeries[] = []

        filledDimensions.forEach((dimension) => {
            const seriesByKey = new Map<EntityName, LineChartSeries>()
            const { column } = dimension
            const { values, isProjection } = column

            for (let i = 0; i < column.times.length; i++) {
                const time = column.times[i]
                const value = parseFloat(values[i] as string)
                const entityName = column.entityNames[i]
                let series = seriesByKey.get(entityName)

                // Not a selected key, don't add any data for it
                if (!selectedEntityNameSet.has(entityName)) continue
                // Can't have values <= 0 on log scale
                if (value <= 0 && yAxis.scaleType === ScaleType.log) continue

                if (!series) {
                    series = {
                        values: [],
                        entityName,
                        isProjection,
                        color: "#000", // tmp
                    }
                    seriesByKey.set(entityName, series)
                }

                series.values.push({ x: time, y: value, time })
            }

            chartData = chartData.concat([...Array.from(seriesByKey.values())])
        })

        this._addColorsToSeries(chartData)

        // Preserve the original ordering for render. Note for line charts, the series order only affects the visual stacking order on overlaps.
        chartData = sortBy(chartData, (series) =>
            selectedEntityNames.indexOf(series.entityName)
        )

        return chartData
    }

    private _addColorsToSeries(allSeries: LineChartSeries[]) {
        // Color from lowest to highest
        const sorted = sortBy(allSeries, (series) => last(series.values)!.y)

        const colors = this.colorScheme.getColors(sorted.length)
        if (this.grapher.invertColorScheme) colors.reverse()

        const table = this.grapher.table

        sorted.forEach((series, i) => {
            series.color =
                table.getColorForEntityName(series.entityName) || colors[i]
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
                entityName: series.entityName,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.grapher.hideLegend
                    ? ""
                    : `${this.grapher.table.getLabelForEntityName(
                          series.entityName
                      )}`,
                annotation: this.getAnnotationsForSeries(series.entityName),
                yValue: lastValue,
            }
        })
    }

    @computed get horizontalAxis() {
        const axis = this.grapher.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings([
            this.startTimelineTime,
            this.endTimelineTime,
        ])
        axis.scaleType = ScaleType.linear
        axis.scaleTypeOptions = [ScaleType.linear]
        axis.column = this.grapher.table.timeColumn
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

    @computed get verticalAxis() {
        const { grapher, yDomain } = this
        const axis = grapher.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomain)
        if (grapher.isRelativeMode) axis.scaleTypeOptions = [ScaleType.linear]
        axis.hideFractionalTicks = this.allValues.every(
            (val) => val.y % 1 === 0
        ) // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.column = grapher.yColumns[0]
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
