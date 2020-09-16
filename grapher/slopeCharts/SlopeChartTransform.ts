import { computed } from "mobx"
import { isEmpty, flatten, identity, last } from "grapher/utils/Util"
import { SlopeChartSeries, SlopeChartValue } from "./LabelledSlopes"
import { ChartTransform } from "grapher/chart/ChartTransform"
import { Time } from "grapher/core/GrapherConstants"
import { ColorScale } from "grapher/color/ColorScale"

// Responsible for translating chart configuration into the form
// of a line chart
export class SlopeChartTransform extends ChartTransform {
    @computed get failMessage() {
        const { filledDimensions } = this.grapher
        if (!filledDimensions.some((d) => d.property === "y"))
            return "Missing Y axis variable"
        else if (isEmpty(this.data)) return "No matching data"
        else return undefined
    }

    @computed get colorScale() {
        const that = this
        return new ColorScale({
            get config() {
                return that.grapher.colorScale
            },
            get defaultBaseColorScheme() {
                return "continents"
            },
            get sortedNumericValues() {
                return that.colorDimension?.sortedNumericValues ?? []
            },
            get categoricalValues() {
                return (
                    that.colorDimension?.column.sortedUniqNonEmptyStringVals ??
                    []
                )
            },
            get hasNoDataBin() {
                return false
            },
            get formatNumericValueFn() {
                return that.colorDimension?.formatValueShortFn ?? identity
            },
        })
    }

    @computed get hasTimeline() {
        return this.timelineTimes.length > 1 && !this.grapher.hideTimeline
    }

    @computed get availableTimes(): Time[] {
        return flatten(
            this.grapher.axisDimensions.map(
                (dimension) => dimension.column.timesUniq
            )
        )
    }

    @computed.struct get xDomain(): [number, number] {
        return [this.startTimelineTime, this.endTimelineTime]
    }

    @computed.struct get sizeDim() {
        return this.grapher.filledDimensions.find((d) => d.property === "size")
    }

    @computed.struct get colorDimension() {
        return this.grapher.filledDimensions.find((d) => d.property === "color")
    }

    @computed.struct get yDimension() {
        return this.grapher.filledDimensions.find((d) => d.property === "y")
    }

    // helper method to directly get the associated color value given an Entity
    // dimension data saves color a level deeper. eg: { Afghanistan => { 2015: Asia|Color }}
    // this returns that data in the form { Afghanistan => Asia }
    @computed get colorByEntity(): Map<string, string | undefined> {
        const { colorDimension, colorScale } = this
        const colorByEntity = new Map<string, string | undefined>()

        if (colorDimension !== undefined) {
            colorDimension.valueByEntityAndTime.forEach(
                (yearToColorMap, entity) => {
                    const values = Array.from(yearToColorMap.values())
                    const key = last(values)
                    colorByEntity.set(entity, colorScale.getColor(key))
                }
            )
        }

        return colorByEntity
    }

    // helper method to directly get the associated size value given an Entity
    // dimension data saves size a level deeper. eg: { Afghanistan => { 1990: 1, 2015: 10 }}
    // this returns that data in the form { Afghanistan => 1 }
    @computed get sizeByEntity(): Map<string, any> {
        const { sizeDim } = this
        const sizeByEntity = new Map<string, any>()

        if (sizeDim !== undefined) {
            sizeDim.valueByEntityAndTime.forEach((yearToSizeMap, entity) => {
                const values = Array.from(yearToSizeMap.values())
                sizeByEntity.set(entity, values[0]) // hack: default to the value associated with the first year
            })
        }
        return sizeByEntity
    }

    @computed get yTickFormat(): (d: number) => string {
        return this.yDimension
            ? this.yDimension.formatValueShortFn
            : (d) => `${d}`
    }

    @computed get data() {
        if (!this.yDimension) return []

        const { yDimension, xDomain, colorByEntity, sizeByEntity } = this

        const table = this.grapher.table

        const minYear = Math.max(xDomain[0])
        const maxYear = Math.min(xDomain[1])

        const entityNames = yDimension.column.entityNamesUniqArr
        let data: SlopeChartSeries[] = entityNames.map((entityName) => {
            const slopeValues: SlopeChartValue[] = []
            const yValues = yDimension.valueByEntityAndTime.get(entityName)
            if (yValues !== undefined) {
                yValues.forEach((value, year) => {
                    if (year === minYear || year === maxYear) {
                        slopeValues.push({
                            x: year,
                            y:
                                typeof value === "string"
                                    ? parseInt(value)
                                    : value,
                        })
                    }
                })
            }

            return {
                entityName,
                label: entityName,
                color:
                    table.getColorForEntityName(entityName) ||
                    colorByEntity.get(entityName) ||
                    "#ff7f0e",
                size: sizeByEntity.get(entityName) || 1,
                values: slopeValues,
            }
        })
        data = data.filter((d) => d.values.length >= 2)
        return data
    }
}
