import { computed } from "mobx"
import { sortBy, valuesByEntityAtYears, es6mapValues, flatten } from "./Util"
import { ChartConfig } from "./ChartConfig"
import { DimensionWithData } from "./DimensionWithData"

type TargetYears = [number] | [number, number]

export interface Dimension {
    dimension: DimensionWithData
    columns: DimensionColumn[]
    valuesByEntity: Map<string, DimensionValue[]>
}

export type ColumnType = "point"

export interface DimensionColumn {
    type: ColumnType
    targetYear?: number
}

export interface DimensionValue {
    value?: string | number
    formattedValue?: string
    year?: number
}

export interface DataTableHeader {
    key: number
    name: string
    unit?: string
    subheaders: DimensionColumn[]
}

export interface DataTableRow {
    entity: string
    values: DataTableValue[]
}

export type DataTableColumn = DimensionColumn

export interface DataTableValue {
    key: string
    value?: string | number
    formattedValue?: string
    year?: number
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

    @computed get dimensionHeaders(): DataTableHeader[] {
        return this.dimensionsWithValues.map(d => ({
            key: d.dimension.variableId,
            name: d.dimension.displayName,
            unit: getHeaderUnit(d.dimension.unit),
            subheaders: d.columns
        }))
    }

    @computed get dimensionsWithValues(): Dimension[] {
        return this.dimensions.map(dim => {
            const targetYears =
                // If a targetYear override is specified on the dimension (scatter plots
                // can do this) then use that target year and ignore the timeline.
                dim.targetYear !== undefined
                    ? [dim.targetYear]
                    : this.targetYears

            const valuesByEntity = valuesByEntityAtYears(
                dim.valueByEntityAndYear,
                targetYears,
                dim.tolerance
            )

            // Add number formatting
            const formattedValuesByEntity = es6mapValues(
                valuesByEntity,
                dvs => {
                    return dvs?.map(dv => {
                        let formattedValue
                        if (dv.value !== undefined) {
                            formattedValue = dim.formatValueShort(dv.value, {
                                autoPrefix: false,
                                noTrailingZeroes: false,
                                unit: getValueUnit(dim.unit)
                            })
                        }
                        return { ...dv, formattedValue }
                    })
                }
            )

            return {
                dimension: dim,
                columns: targetYears.map(targetYear => ({
                    type: "point",
                    targetYear
                })),
                valuesByEntity: formattedValuesByEntity
            }
        })
    }

    @computed get displayColumns(): DataTableColumn[] {
        return flatten(this.dimensionsWithValues.map(d => d.columns))
    }

    @computed get displayRows(): DataTableRow[] {
        const entities = sortBy(this.chart.data.availableEntities)
        return entities.map(entity => {
            const values = flatten(
                this.dimensionsWithValues.map(d => {
                    const values = d.valuesByEntity.get(entity) || []
                    return values.map((v, index) => ({
                        ...v,
                        key: `${d.dimension.variableId}-${index}`
                    }))
                })
            )
            return {
                entity,
                values
            }
        })
    }
}
