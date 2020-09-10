import { observable, computed } from "mobx"
import {
    formatValue,
    isString,
    formatDay,
    formatYear,
    last,
    isNumber,
    sortedUniq,
    sortNumeric,
    trimObject,
    extend,
} from "grapher/utils/Util"
import {
    TickFormattingOptions,
    EntityDimensionKey,
} from "grapher/core/GrapherConstants"
import { AbstractColumn } from "owidTable/OwidTable"
import { Time } from "grapher/utils/TimeBounds"

import { LegacyVariableDisplaySettings } from "owidTable/LegacyVariableCode"
import {
    OwidSource,
    LegacyVariableId,
    EntityName,
    EntityId,
} from "owidTable/OwidTableConstants"
import { Persistable } from "grapher/persistable/Persistable"

export declare type dimensionProperty = "y" | "x" | "size" | "color" | "table"

export interface SourceWithDimension {
    source: OwidSource
    dimension: ChartDimension
}

export interface ChartDimensionConfig {
    property: dimensionProperty
    variableId: LegacyVariableId
    targetYear?: Time
    display?: LegacyVariableDisplaySettings
    saveToVariable?: boolean // todo: remove
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
export class PersistableChartDimension
    implements ChartDimensionConfig, Persistable {
    @observable property!: dimensionProperty
    @observable variableId!: LegacyVariableId

    // check on: malaria-deaths-comparisons and computing-efficiency

    @observable display: LegacyVariableDisplaySettings = {}

    // XXX move this somewhere else, it's only used for scatter x override
    @observable targetYear?: Time = undefined

    // If enabled, dimension settings will be saved onto variable as defaults
    // for future charts
    // todo: remove this. Add an explicit "Update variable button"
    @observable saveToVariable?: true = undefined

    constructor(obj?: ChartDimensionConfig) {
        if (obj) this.updateFromObject(obj)
    }

    updateFromObject(obj: ChartDimensionConfig) {
        if (obj.display) extend(this.display, obj.display)

        this.targetYear = obj.targetYear
        this.variableId = obj.variableId
        this.property = obj.property
    }

    toObject(): ChartDimensionConfig {
        return trimObject({
            targetYear: this.targetYear,
            variableId: this.variableId,
            property: this.property,
            display: Object.keys(this.display).length
                ? this.display
                : undefined,
        })
    }
}

export class ChartDimension extends PersistableChartDimension {
    @observable.ref index: number

    constructor(
        obj: ChartDimensionConfig,
        index: number,
        column: AbstractColumn
    ) {
        super(obj)
        this.index = index
        this.column = column
    }

    @computed get columnSlug(): string {
        return this.variableId.toString()
    }

    @computed get displayName(): string {
        return this.display.name ?? this.column.display.name ?? this.column.name
    }

    @computed get includeInTable(): boolean {
        return (
            this.property !== "color" &&
            (this.column.display.includeInTable ?? true)
        )
    }

    @computed get unit(): string {
        return this.display.unit ?? this.column.display.unit ?? this.column.unit
    }

    // Full name of the variable with associated unit information, used for data export
    @computed get fullNameWithUnit(): string {
        return this.displayName + (this.unit ? ` (${this.unit})` : "")
    }

    @computed get unitConversionFactor(): number {
        return (
            this.display.conversionFactor ??
            this.column.display.conversionFactor ??
            1
        )
    }

    @computed get isProjection(): boolean {
        return !!(this.display.isProjection ?? this.column.display.isProjection)
    }

    @computed get tolerance(): number {
        return (
            this.display.tolerance ??
            this.column.display.tolerance ??
            (this.property === "color" ? Infinity : 0)
        )
    }

    @computed get numDecimalPlaces(): number {
        return (
            this.display.numDecimalPlaces ??
            this.column.display.numDecimalPlaces ??
            2
        )
    }

    @computed get shortUnit(): string {
        const { unit } = this
        const shortUnit =
            this.display.shortUnit ??
            this.column.display.shortUnit ??
            (this.column.shortUnit || undefined)

        if (shortUnit !== undefined) return shortUnit

        if (!unit) return ""

        if (unit.length < 3) return unit
        else {
            const commonShortUnits = ["$", "£", "€", "%"]
            if (commonShortUnits.some((u) => unit[0] === u)) return unit[0]
            else return ""
        }
    }

    @computed get formatValueShortFn(): (
        value: number | string,
        options?: TickFormattingOptions
    ) => string {
        const { shortUnit, numDecimalPlaces } = this
        return (value, options) =>
            isString(value)
                ? value
                : formatValue(value, {
                      unit: shortUnit,
                      numDecimalPlaces,
                      ...options,
                  })
    }

    @computed get formatValueLongFn(): (
        value: number | string,
        options?: TickFormattingOptions
    ) => string {
        const { unit, numDecimalPlaces } = this
        return (value, options) =>
            isString(value)
                ? value
                : formatValue(value, {
                      unit: unit,
                      numDecimalPlaces: numDecimalPlaces,
                      ...options,
                  })
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
        return unitConversionFactor === 1
            ? this.column.values
            : this.column.values.map(
                  (v) => (v as number) * unitConversionFactor
              )
    }

    @computed get sortedNumericValues(): number[] {
        return sortNumeric(
            this.values.filter(isNumber).filter((v) => !isNaN(v))
        )
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
}
