import { computed } from "mobx"

import { ChartData } from "./ChartData"
import { DimensionWithData } from "./DimensionWithData"
import { reduce, max } from "./Util"

export interface DimensionHeader {
    key: number
    name: string
}

export interface DimensionValue {
    key: number
    value: string | undefined
}

export interface DataTableRow {
    entity: string
    dimensionValues: DimensionValue[]
}

export class DataTableTransform {
    data: ChartData

    constructor(data: ChartData) {
        this.data = data
    }

    @computed get dimensions() {
        return this.data.filledDimensions
    }

    @computed get entities() {
        return this.data.availableEntities
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
        let formatted
        const valueByYear = dim.valueByEntityAndYear.get(entity)
        const year = this.yearByVariable.get(dim.variableId)
        if (valueByYear !== undefined && year !== undefined) {
            const value = valueByYear.get(year)
            if (value !== undefined) {
                formatted = dim.formatValueShort(value)
            }
        }
        return { key: dim.variableId, value: formatted }
    }

    @computed get allRows(): DataTableRow[] {
        return this.entities.map(entity => ({
            entity: entity,
            dimensionValues: this.dimensions.map(dim =>
                this.makeDimensionValue(dim, entity)
            )
        }))
    }

    @computed get displayRows() {
        return this.allRows.filter(row => {
            return row.dimensionValues.some(dv => dv.value !== undefined)
        })
    }
}
