import { observable, computed } from "mobx"
import {
    formatValue,
    isString,
    formatDay,
    formatYear,
    last,
    isNumber,
    sortNumeric,
    trimObject,
} from "grapher/utils/Util"
import {
    TickFormattingOptions,
    EntityDimensionKey,
    DimensionProperty,
    Time,
} from "grapher/core/GrapherConstants"
import { LoadingColumn, OwidTable } from "owidTable/OwidTable"

import {
    LegacyVariableDisplayConfigInterface,
    LegacyVariableDisplayConfig,
} from "owidTable/LegacyVariableCode"
import {
    OwidSource,
    LegacyVariableId,
    EntityName,
    EntityId,
} from "owidTable/OwidTableConstants"
import {
    Persistable,
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    updatePersistables,
} from "grapher/persistable/Persistable"

export interface SourceWithDimension {
    source: OwidSource
    dimension: ChartDimension
}

export interface ChartDimensionInterface {
    property: DimensionProperty
    variableId: LegacyVariableId
    targetTime?: Time
    display?: LegacyVariableDisplayConfigInterface
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
class ChartDimensionDefaults implements ChartDimensionInterface {
    @observable property!: DimensionProperty
    @observable variableId!: LegacyVariableId

    // check on: malaria-deaths-comparisons and computing-efficiency

    @observable display = new LegacyVariableDisplayConfig() // todo: make persistable

    // XXX move this somewhere else, it's only used for scatter x override
    @observable targetTime?: Time = undefined
}

export class ChartDimension
    extends ChartDimensionDefaults
    implements Persistable {
    @observable.ref private table: OwidTable

    constructor(obj: ChartDimensionInterface, table: OwidTable) {
        super()
        this.table = table
        if (obj) this.updateFromObject(obj)
    }

    updateFromObject(obj: ChartDimensionInterface) {
        updatePersistables(this, obj)

        this.targetTime = obj.targetTime
        this.variableId = obj.variableId
        this.property = obj.property
    }

    toObject(): ChartDimensionInterface {
        return trimObject(
            deleteRuntimeAndUnchangedProps(
                objectWithPersistablesToObject(this),
                new ChartDimensionDefaults()
            )
        )
    }

    @computed get column() {
        return (
            this.table.columnsByOwidVarId.get(this.variableId) ||
            new LoadingColumn(this.table, {
                slug: this.variableId?.toString() || "loading",
            })
        )
    }

    @computed get columnSlug() {
        return this.variableId.toString()
    }

    @computed get isLoaded() {
        return this.table.columnsByOwidVarId.has(this.variableId)
    }

    @computed get displayName() {
        return this.display.name ?? this.columnDisplay.name ?? this.column.name
    }

    @computed get columnDisplay() {
        return this.column.display
    }

    @computed get includeInTable() {
        return (
            this.property !== "color" &&
            (this.columnDisplay.includeInTable ?? true)
        )
    }

    @computed get unit() {
        return this.display.unit ?? this.columnDisplay.unit ?? this.column.unit
    }

    // Full name of the variable with associated unit information, used for data export
    @computed get fullNameWithUnit() {
        return `${this.displayName}${this.unit ? ` (${this.unit})` : ""}`
    }

    @computed get unitConversionFactor() {
        return (
            this.display.conversionFactor ??
            this.columnDisplay.conversionFactor ??
            1
        )
    }

    @computed get isProjection() {
        return !!(this.display.isProjection ?? this.columnDisplay.isProjection)
    }

    @computed get tolerance() {
        return (
            this.display.tolerance ??
            this.columnDisplay.tolerance ??
            (this.property === "color" ? Infinity : 0)
        )
    }

    @computed get numDecimalPlaces() {
        return (
            this.display.numDecimalPlaces ??
            this.columnDisplay.numDecimalPlaces ??
            2
        )
    }

    @computed get shortUnit() {
        const { unit } = this
        const shortUnit =
            this.display.shortUnit ??
            this.columnDisplay.shortUnit ??
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

    @computed get formatTimeFn(): (
        time: Time,
        options?: { format?: string }
    ) => string {
        return this.column.isDailyMeasurement
            ? (day: Time, options?) => formatDay(day, options)
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

    @computed get sortedNumericValues() {
        return sortNumeric(
            this.values.filter(isNumber).filter((v) => !isNaN(v))
        )
    }

    timeAndValueOfLatestValueforEntity(entity: string) {
        const valueByTime = this.valueByEntityAndTime.get(entity)
        return valueByTime ? last(Array.from(valueByTime)) ?? null : null
    }

    @computed get valueByEntityAndTime() {
        const valueByEntityAndTime = new Map<
            string,
            Map<number, string | number>
        >()
        for (let i = 0; i < this.values.length; i++) {
            const column = this.column
            const entity = column.entityNames[i]
            const time = column.times[i]
            const value = this.values[i]

            let valueByTime = valueByEntityAndTime.get(entity)
            if (!valueByTime) {
                valueByTime = new Map()
                valueByEntityAndTime.set(entity, valueByTime)
            }
            valueByTime.set(time, value)
        }
        return valueByEntityAndTime
    }
}
