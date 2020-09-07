import { observable, computed } from "mobx"
import {
    defaultTo,
    formatValue,
    some,
    isString,
    formatDay,
    formatYear,
    last,
    isNumber,
    extend,
    sortedUniq,
    sortNumeric
} from "grapher/utils/Util"
import {
    TickFormattingOptions,
    EntityDimensionKey
} from "grapher/core/GrapherConstants"
import {
    AbstractColumn,
    owidVariableId,
    EntityName,
    EntityId
} from "owidTable/OwidTable"
import { Time } from "grapher/utils/TimeBounds"

import {
    OwidVariableDisplaySettings,
    OwidVariableTableDisplaySettings
} from "owidTable/OwidVariable"
import { OwidSource } from "owidTable/OwidSource"

export declare type dimensionProperty = "y" | "x" | "size" | "color" | "table"

export interface SourceWithDimension {
    source: OwidSource
    dimension: ChartDimension
}

export interface ChartDimensionInterface {
    property: dimensionProperty
    variableId: owidVariableId
    targetYear?: Time
    display?: OwidVariableDisplaySettings
}

export interface EntityDimensionInfo {
    entityName: EntityName
    entityId: EntityId
    dimension: ChartDimension
    index: number
    entityDimensionKey: EntityDimensionKey
    fullLabel: string
    label: string
    shortCode: string
}

// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data
export class ChartDimensionSpec implements ChartDimensionInterface {
    @observable property!: dimensionProperty
    @observable variableId!: owidVariableId

    // check on: malaria-deaths-comparisons and computing-efficiency

    @observable display: OwidVariableDisplaySettings = {
        name: undefined,
        unit: undefined,
        shortUnit: undefined,
        isProjection: undefined,
        conversionFactor: undefined,
        numDecimalPlaces: undefined,
        tolerance: undefined,
        tableDisplay: new OwidVariableTableDisplaySettings()
    }

    // XXX move this somewhere else, it's only used for scatter x override
    @observable targetYear?: Time = undefined

    // If enabled, dimension settings will be saved onto variable as defaults
    // for future charts
    // todo: remove this. Add an explicit "Update variable button"
    @observable saveToVariable?: true = undefined

    constructor(spec: ChartDimensionInterface) {
        if (spec.display) extend(this.display, spec.display)

        this.targetYear = spec.targetYear
        this.variableId = spec.variableId
        this.property = spec.property
    }
}

export class ChartDimension {
    spec: ChartDimensionSpec
    @observable.ref index: number

    @computed get variableId(): owidVariableId {
        return this.spec.variableId
    }

    @computed get property(): string {
        return this.spec.property
    }

    @computed get displayName(): string {
        return defaultTo(
            defaultTo(this.spec.display.name, this.column.display.name),
            this.column.name
        )
    }

    @computed get includeInTable(): boolean {
        return (
            this.property !== "color" &&
            (this.column.display.includeInTable ?? true)
        )
    }

    @computed get unit(): string {
        return defaultTo(
            defaultTo(this.spec.display.unit, this.column.display.unit),
            this.column.unit
        )
    }

    // Full name of the variable with associated unit information, used for data export
    @computed get fullNameWithUnit(): string {
        return this.displayName + (this.unit ? ` (${this.unit})` : "")
    }

    @computed get unitConversionFactor(): number {
        return defaultTo(
            defaultTo(
                this.spec.display.conversionFactor,
                this.column.display.conversionFactor
            ),
            1
        )
    }

    @computed get isProjection(): boolean {
        return !!defaultTo(
            this.spec.display.isProjection,
            this.column.display.isProjection
        )
    }

    @computed get targetYear(): number | undefined {
        return this.spec.targetYear
    }

    @computed get tolerance(): number {
        return defaultTo(
            defaultTo(
                this.spec.display.tolerance,
                this.column.display.tolerance
            ),
            this.property === "color" ? Infinity : 0
        )
    }

    @computed get numDecimalPlaces(): number {
        return defaultTo(
            defaultTo(
                this.spec.display.numDecimalPlaces,
                this.column.display.numDecimalPlaces
            ),
            2
        )
    }

    @computed get shortUnit(): string {
        const { unit } = this
        const shortUnit = defaultTo(
            defaultTo(
                this.spec.display.shortUnit,
                this.column.display.shortUnit
            ),
            this.column.shortUnit || undefined
        )

        if (shortUnit !== undefined) return shortUnit

        if (!unit) return ""

        if (unit.length < 3) return unit
        else {
            const commonShortUnits = ["$", "£", "€", "%"]
            if (some(commonShortUnits, u => unit[0] === u)) return unit[0]
            else return ""
        }
    }

    @computed get formatValueShort(): (
        value: number | string,
        options?: TickFormattingOptions
    ) => string {
        const { shortUnit, numDecimalPlaces } = this
        return (value, options) => {
            if (isString(value)) return value
            else
                return formatValue(value, {
                    unit: shortUnit,
                    numDecimalPlaces,
                    ...options
                })
        }
    }

    @computed get formatValueLong(): (
        value: number | string,
        options?: TickFormattingOptions
    ) => string {
        const { unit, numDecimalPlaces } = this
        return (value, options) => {
            if (isString(value)) return value
            else
                return formatValue(value, {
                    unit: unit,
                    numDecimalPlaces: numDecimalPlaces,
                    ...options
                })
        }
    }

    @computed get formatYear(): (
        year: number,
        options?: { format?: string }
    ) => string {
        return this.column.isDailyMeasurement
            ? (year: number, options?) => formatDay(year, options)
            : formatYear
    }

    // todo: remove unitConversionFactor concept? use computed columns instead?
    // note: unitConversionFactor is used >400 times in charts and >800 times in variables!!!
    @computed get values(): (number | string)[] {
        const { unitConversionFactor } = this
        if (unitConversionFactor !== 1)
            return this.column.values.map(
                v => (v as number) * unitConversionFactor
            )
        else return this.column.values
    }

    @computed get sortedNumericValues(): number[] {
        return sortNumeric(this.values.filter(isNumber).filter(v => !isNaN(v)))
    }

    get yearsUniq() {
        return sortedUniq(this.years)
    }

    get years(): Time[] {
        return this.column.years
    }

    get entityNamesUniq(): EntityName[] {
        return Array.from(this.column.entityNamesUniq)
    }

    get entityNames() {
        return this.column.entityNames
    }

    yearAndValueOfLatestValueforEntity(entity: string) {
        const valueByYear = this.valueByEntityAndYear.get(entity)
        return valueByYear ? last(Array.from(valueByYear)) ?? null : null
    }

    @computed get valueByEntityAndYear(): Map<
        string,
        Map<number, string | number>
    > {
        const valueByEntityAndYear = new Map<
            string,
            Map<number, string | number>
        >()
        for (let i = 0; i < this.values.length; i++) {
            const entity = this.entityNames[i]
            const year = this.years[i]
            const value = this.values[i]

            let valueByYear = valueByEntityAndYear.get(entity)
            if (!valueByYear) {
                valueByYear = new Map()
                valueByEntityAndYear.set(entity, valueByYear)
            }
            valueByYear.set(year, value)
        }
        return valueByEntityAndYear
    }

    @observable.ref column: AbstractColumn

    constructor(
        index: number,
        dimensionSpec: ChartDimensionSpec,
        column: AbstractColumn
    ) {
        this.index = index
        this.spec = dimensionSpec
        this.column = column
    }
}
