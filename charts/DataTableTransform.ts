import { computed } from "mobx"
import { DimensionWithData } from "./DimensionWithData"
import { sortBy, flatten, findClosestYear } from "./Util"
import { ChartConfig } from "./ChartConfig"

type TargetYears = [number] | [number, number]

export interface DimensionHeader {
    key: number
    name: string
    colSpan: number
    unit?: string
}

export interface DimensionValue {
    key: string
    value?: string | number
    formattedValue?: string
    year?: number
    targetYear?: number
}

export interface DataTableRow {
    entity: string
    dimensionValues: DimensionValue[]
}

function getHeaderUnit(unit: string) {
    return unit !== "%" ? unit : "percent"
}

function getValueUnit(unit: string) {
    return unit !== "%" ? undefined : unit
}

export class DataTableTransform {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    @computed get dimensions() {
        return this.chart.data.filledDimensions
    }

    @computed get entities() {
        return this.chart.data.availableEntities
    }

    @computed get targetYears(): TargetYears {
        const mapTarget = this.chart.map.props.targetYear
        const { timeDomain } = this.chart
        if (this.chart.tab === "map" && mapTarget !== undefined) {
            return [mapTarget]
        } else if (timeDomain[0] !== undefined && timeDomain[1] !== undefined) {
            if (timeDomain[0] === timeDomain[1]) return [timeDomain[0]]
            else return [timeDomain[0], timeDomain[1]]
        } else {
            return [new Date().getFullYear()]
        }
    }

    @computed get dimensionHeaders(): DimensionHeader[] {
        return this.dimensions.map(dim => ({
            key: dim.variableId,
            name: dim.displayName,
            colSpan: this.targetYears.length,
            unit: getHeaderUnit(dim.unit)
        }))
    }

    makeDimensionValues(
        dim: DimensionWithData,
        entity: string,
        targetYears: TargetYears
    ): DimensionValue[] {
        const valueByYear = dim.valueByEntityAndYear.get(entity)
        const years = Array.from(valueByYear?.keys() || [])
        return targetYears.map((targetYear, index) => {
            let value, formatted
            const year = findClosestYear(years, targetYear, dim.tolerance)
            if (valueByYear !== undefined && year !== undefined) {
                value = valueByYear.get(year)
                if (value !== undefined) {
                    formatted = dim.formatValueShort(value, {
                        autoPrefix: false,
                        noTrailingZeroes: false,
                        unit: getValueUnit(dim.unit)
                    })
                }
            }
            return {
                key: `${dim.variableId}-${index}`,
                value,
                formattedValue: formatted,
                year,
                targetYear
            }
        })
    }

    @computed get rows(): DataTableRow[] {
        return this.entities.map(entity => ({
            entity: entity,
            dimensionValues: flatten(
                this.dimensions.map(dim =>
                    this.makeDimensionValues(dim, entity, this.targetYears)
                )
            )
        }))
    }

    @computed get displayRows() {
        const filteredRows = this.rows.filter(row => {
            return row.dimensionValues.some(
                dv => dv.formattedValue !== undefined
            )
        })

        return sortBy(filteredRows, r => r.entity)
    }
}
