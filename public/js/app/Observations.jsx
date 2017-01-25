// @flow

import * as _ from '../libs/underscore'

export default class Observations {
	data: Object[]

	constructor(data : Object[]) {
		this.data = data
	}

	mergeBy(key : string, mergeFMaybe? : (Observations, any) => Object) {
		const mergeF = mergeFMaybe || ((rows) => {
			const merged = {}
			rows.each((row) => {
				_.extend(merged, row)
			})
			return merged
		})

		return new Observations(_.map(_.groupBy(this.data, (d) => d[key]), (arr, key) => mergeF(new Observations(arr), key)))
	}

	filter(filterF : (Object) => boolean) {
		return new Observations(_.filter(this.data, filterF))
	}

	map(mapF : (Object) => Object) {
		return new Observations(_.map(this.data, mapF))
	}

	each(eachF : (Object) => void) {
		_.each(this.data, eachF)
	}

	minValue(key : string) {
		return _.min(_.pluck(this.data, key))
	}

	maxValue(key : string) {
		return _.max(_.pluck(this.data, key))
	}

	first(key : string) {
		return (_.find(this.data, (d) => d[key] !== undefined)||{})[key]
	}

	toArray() {
		return this.data
	}
}