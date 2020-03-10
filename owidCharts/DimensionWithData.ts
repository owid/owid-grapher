import { Variable } from "./VariableData"
import { observable, computed } from "mobx"
import {
    defaultTo,
    formatValue,
    some,
    isString,
    sortBy,
    isNumber
} from "./Util"
import { ChartDimension } from "./ChartDimension"
import { TickFormattingOptions } from "./TickFormattingOptions"

export class DimensionWithData {
    props: ChartDimension
    @observable.ref index: number
    @observable.ref variable: Variable

    @computed get variableId(): number {
        return this.props.variableId
    }

    @computed get property(): string {
        return this.props.property
    }

    @computed get displayName(): string {
        return defaultTo(
            defaultTo(this.props.display.name, this.variable.display.name),
            this.variable.name
        )
    }

    @computed get unit(): string {
        return defaultTo(
            defaultTo(this.props.display.unit, this.variable.display.unit),
            this.variable.unit
        )
    }

    // Full name of the variable with associated unit information, used for data export
    @computed get fullNameWithUnit(): string {
        return this.displayName + (this.unit ? ` (${this.unit})` : "")
    }

    @computed get unitConversionFactor(): number {
        return defaultTo(
            defaultTo(
                this.props.display.conversionFactor,
                this.variable.display.conversionFactor
            ),
            1
        )
    }

    @computed get isProjection(): boolean {
        return !!defaultTo(
            this.props.display.isProjection,
            this.variable.display.isProjection
        )
    }

    @computed get targetYear(): number | undefined {
        return this.props.targetYear
    }

    @computed get tolerance(): number {
        return defaultTo(
            defaultTo(
                this.props.display.tolerance,
                this.variable.display.tolerance
            ),
            0
        )
    }

    @computed get numDecimalPlaces(): number {
        return defaultTo(
            defaultTo(
                this.props.display.numDecimalPlaces,
                this.variable.display.numDecimalPlaces
            ),
            2
        )
    }

    @computed get shortUnit(): string {
        const { unit } = this
        const shortUnit = defaultTo(
            defaultTo(
                this.props.display.shortUnit,
                this.variable.display.shortUnit
            ),
            this.variable.shortUnit || undefined
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
                    numDecimalPlaces: numDecimalPlaces,
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

    @computed get values() {
        const { unitConversionFactor } = this
        if (unitConversionFactor !== 1)
            return this.variable.values.map(
                v => (v as number) * unitConversionFactor
            )
        else return this.variable.values
    }

    @computed get numericValues(): number[] {
        return sortBy(this.values.filter(v => isNumber(v))) as number[]
    }

    @computed get hasNumericValues(): boolean {
        return this.numericValues.length > 0
    }

    @computed get minValue(): number {
        return this.variable.minValue * this.unitConversionFactor
    }

    @computed get maxValue(): number {
        return this.variable.maxValue * this.unitConversionFactor
    }

    get yearsUniq() {
        return this.variable.yearsUniq
    }

    get entitiesUniq() {
        return this.variable.entitiesUniq
    }

    get years() {
        return this.variable.years
    }

    get entities() {
        return this.variable.entities
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
            const entity = this.entities[i]
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

    constructor(index: number, dimension: ChartDimension, variable: Variable) {
        this.index = index
        this.props = dimension
        this.variable = variable
    }
}
