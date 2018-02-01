import { Variable } from './VariableData'
import { observable, computed } from 'mobx'
import { defaultTo, formatValue, some, isString, sortBy, isNumber } from './Util'
import ChartDimension from './ChartDimension'

export default class DimensionWithData {
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
        return defaultTo(defaultTo(this.props.displayName, this.variable.displayName), this.variable.name)
    }

    @computed get unit(): string {
        return defaultTo(defaultTo(this.props.unit, this.variable.displayUnit), this.variable.unit)
    }

    // Full name of the variable with associated unit information, used for data export
    @computed get fullNameWithUnit(): string {
        return this.displayName + (this.unit ? ` (${this.unit})` : "")
    }

    @computed get unitConversionFactor(): number {
        return defaultTo(defaultTo(this.props.conversionFactor, this.variable.displayUnitConversionFactor), 1)
    }

    @computed get isProjection(): boolean {
        return !!defaultTo(this.props.isProjection, this.variable.displayIsProjection)
    }

    @computed get targetYear(): number | undefined {
        return this.props.targetYear
    }

    @computed get tolerance(): number {
        return defaultTo(defaultTo(this.props.tolerance, this.variable.displayTolerance), 0)
    }

    @computed get numDecimalPlaces(): number {
        return defaultTo(defaultTo(this.props.numDecimalPlaces, this.variable.displayNumDecimalPlaces), 2)
    }

    @computed get shortUnit(): string {
        const { unit } = this
        const shortUnit = defaultTo(defaultTo(this.props.shortUnit, this.variable.displayShortUnit), this.variable.shortUnit||undefined)

        if (shortUnit !== undefined) return shortUnit

        if (!unit) return ""

        if (unit.length < 3)
            return unit
        else {
            const commonShortUnits = ['$', '£', '€', '%']
            if (some(commonShortUnits, u => unit[0] === u))
                return unit[0]
            else
                return ""
        }
    }

    @computed get formatValueShort(): (value: number | string) => string {
        const { shortUnit, numDecimalPlaces } = this
        return value => {
            if (isString(value))
                return value
            else
                return formatValue(value, { unit: shortUnit, numDecimalPlaces: numDecimalPlaces })
        }
    }

    @computed get formatValueLong(): (value: number) => string {
        const { unit, numDecimalPlaces } = this
        return value => {
            if (isString(value))
                return value
            else
                return formatValue(value, { unit: unit, numDecimalPlaces: numDecimalPlaces })
        }
    }

    @computed get values() {
        const { unitConversionFactor } = this
        if (unitConversionFactor !== 1)
            return this.variable.values.map(v => (v as number) * unitConversionFactor)
        else
            return this.variable.values
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

    @computed get valueByEntityAndYear(): Map<string, Map<number, (string | number)>> {
        const valueByEntityAndYear = new Map<string, Map<number, (string | number)>>()
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
