// @flow

import _ from 'lodash'

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

	sortBy(sortF : (any) => number) {
		return new Observations(_.sortBy(this.data, sortF))
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
		return _.min(_.map(this.data, key))
	}

	maxValue(key : string) {
		return _.max(_.map(this.data, key))
	}

	first(key? : string) {
		if (key == null)
			return _.first(this.data)
		else
			return (_.find(this.data, (d) => d[key] !== undefined)||{})[key]
	}

	last(key? : string) {
		if (key == null)
			return _.last(this.data)
//		else
//			return (_.find(this.data, (d) => d[key] !== undefined)||{})[key]
	}

	toArray() {
		return this.data
	}

	pluck(key : string) {
		return _.map(this.data, key)
	}
}