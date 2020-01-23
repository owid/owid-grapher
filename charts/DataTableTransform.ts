import { computed } from "mobx"
import { DimensionWithData } from "./DimensionWithData"
import { reduce, max, sortBy } from "./Util"
import { ChartConfig } from "./ChartConfig"

export interface DimensionHeader {
    key: number
    name: string
}

export interface DimensionValue {
    key: number
    value?: string | number
    formattedValue?: string
}

export interface DataTableRow {
    entity: string
    dimensionValues: DimensionValue[]
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

    @computed get yearByVariable() {
        return reduce(
            this.dimensions,
            (map, dim) => map.set(dim.variableId, max(dim.years)),
            new Map<number, number | undefined>()
        )
    }

    @computed get dimensionHeaders(): DimensionHeader[] {
        return this.dimensions.map(dim => ({
            key: dim.variableId,
            name: dim.displayName
        }))
    }

    makeDimensionValue(dim: DimensionWithData, entity: string): DimensionValue {
        let value, formatted
        const valueByYear = dim.valueByEntityAndYear.get(entity)
        const year = this.yearByVariable.get(dim.variableId)
        if (valueByYear !== undefined && year !== undefined) {
            value = valueByYear.get(year)
            if (value !== undefined) {
                formatted = dim.formatValueShort(value, { autoPrefix: false })
            }
        }
        return { key: dim.variableId, value, formattedValue: formatted }
    }

    @computed get rows(): DataTableRow[] {
        return this.entities.map(entity => ({
            entity: entity,
            dimensionValues: this.dimensions.map(dim =>
                this.makeDimensionValue(dim, entity)
            )
        }))
    }

    @computed get displayRows() {
        const filteredRows = this.rows.filter(row => {
            return row.dimensionValues.some(
                dv => dv.formattedValue !== undefined
            )
        })

        return sortBy(filteredRows, r => r.dimensionValues[0].value)
    }
}
