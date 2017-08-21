import * as _ from 'lodash'

export default class Observations {
	data: Object[]

	constructor(data : Object[]) {
		this.data = data
	}

	mergeBy(key: string, mergeFMaybe?: (o: Observations, key: any) => Object) {
		const mergeF = mergeFMaybe || ((rows) => {
			const merged = {}
			rows.each((row) => {
				_.extend(merged, row)
			})
			return merged
		})

		return new Observations(_.map(_.groupBy(this.data, (d: any) => d[key]), (arr: any, key: any) => mergeF(new Observations(arr), key)))
	}

	sortBy(sortF: (row: any) => number) {
		return new Observations(_.sortBy(this.data, sortF))
	}

	filter(filterF : (row: any) => boolean) {
		return new Observations(_.filter(this.data, filterF))
	}

	map(mapF: (row: any) => any) {
		return new Observations(_.map(this.data, mapF))
	}

	each(eachF: (row: any) => void) {
		_.each(this.data, eachF)
	}

	minValue(key : any) {
		return _.min(_.map(this.data, key))
	}

	maxValue(key : any) {
		return _.max(_.map(this.data, key))
	}

	first(key? : any) {
		if (key == null)
			return _.first(this.data)
		else
			return (_.find(this.data, (d: any) => d[key] !== undefined)||{})[key]
	}

	last(key? : any) {
		if (key == null)
			return _.last(this.data)
//		else
//			return (_.find(this.data, (d) => d[key] !== undefined)||{})[key]
	}

	toArray() {
		return this.data
	}

	pluck(key : any) {
		return _.map(this.data, key)
	}
}