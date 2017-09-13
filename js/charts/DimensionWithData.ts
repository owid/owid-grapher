import {ChartDimension} from './ChartConfig'
import {Variable} from './VariableData'
import {observable, computed} from 'mobx'
import {defaultTo, formatValue, some} from './Util'

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
		return defaultTo(this.props.displayName, this.variable.name)
	}

	@computed get unit(): string {
		return defaultTo(this.props.unit, this.variable.unit)
	}

	@computed get isProjection(): boolean {
		return !!this.props.isProjection
	}

	@computed get targetYear(): number|undefined {
		return this.props.targetYear
	}

	@computed get tolerance(): number {
		return this.props.tolerance == null ? 0 : this.props.tolerance
	}

	@computed get shortUnit(): string|undefined {
		const {unit} = this
		const shortUnit = defaultTo(this.props.shortUnit, this.variable.shortUnit)
		
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

	@computed get formatValueShort(): (value: number) => string {
		const {shortUnit} = this
		return value => formatValue(value, { unit: shortUnit })
	}

	@computed get formatValueLong(): (value: number) => string {
		const {unit} = this
		return value => formatValue(value, { unit: unit })
	}

	@computed get values() {
		const {conversionFactor} = this.props
		if (conversionFactor)
			return this.variable.values.map(v => (v as number)*conversionFactor)
		else
			return this.variable.values
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