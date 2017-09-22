import {Variable} from './VariableData'
import {observable, computed} from 'mobx'
import {defaultTo, formatValue, some, isString} from './Util'
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

	@computed get unitConversionFactor(): number {
		return defaultTo(defaultTo(this.props.conversionFactor, this.variable.displayUnitConversionFactor), 1)
	}

	@computed get isProjection(): boolean {
		return !!defaultTo(this.props.isProjection, this.variable.displayIsProjection)
	}

	@computed get targetYear(): number|undefined {
		return this.props.targetYear
	}

	@computed get tolerance(): number {
		return defaultTo(defaultTo(this.props.tolerance, this.variable.displayTolerance), 0)
	}

	@computed get shortUnit(): string|undefined {
		const {unit} = this
		const shortUnit = defaultTo(defaultTo(this.props.shortUnit, this.variable.displayShortUnit), this.variable.shortUnit)
			
		if (shortUnit) return shortUnit

		if (!unit) return undefined

		if (unit.length < 3)
			return unit
		else {
			const commonShortUnits = ['$', '£', '€', '%']
			if (some(commonShortUnits, u => unit[0] == u))
				return unit[0]
			else
				return undefined
		}
	}

	@computed get formatValueShort(): (value: number|string) => string {
		const {shortUnit} = this
		return value => {
			if (isString(value))
				return value
			else
				return formatValue(value, { unit: shortUnit })
		}
	}

	@computed get formatValueLong(): (value: number) => string {
		const {unit} = this
		return value => {
			if (isString(value))
				return value
			else
				return formatValue(value, { unit: unit })
		}
	}

	@computed get values() {
		const {unitConversionFactor} = this
		if (unitConversionFactor != 1)
			return this.variable.values.map(v => (v as number)*unitConversionFactor)
		else
			return this.variable.values
	}

	@computed get minValue(): number {
		return this.variable.minValue*this.unitConversionFactor
	}

	@computed get maxValue(): number {
		return this.variable.maxValue*this.unitConversionFactor
	}

	get years() {
		return this.variable.years
	}

	get entities() {
		return this.variable.entities
	}

    constructor(index: number, dimension: ChartDimension, variable: Variable) {
		this.index = index
        this.props = dimension
		this.variable = variable
    }
}