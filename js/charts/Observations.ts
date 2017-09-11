import {extend, map, groupBy, sortBy, filter, each, min, max, find, first, last} from './Util'

export default class Observations {
	data: Object[]

	constructor(data : Object[]) {
		this.data = data
	}

	mergeBy(key: string, mergeFMaybe?: (o: Observations, key: any) => Object) {
		const mergeF = mergeFMaybe || ((rows) => {
			const merged = {}
			rows.each((row) => {
				extend(merged, row)
			})
			return merged
		})

		return new Observations(map(groupBy(this.data, (d: any) => d[key]), (arr: any, key: any) => mergeF(new Observations(arr), key)))
	}

	sortBy(sortF: (row: any) => number) {
		return new Observations(sortBy(this.data, sortF))
	}

	filter(filterF : (row: any) => boolean) {
		return new Observations(filter(this.data, filterF))
	}

	map(mapF: (row: any) => any) {
		return new Observations(map(this.data, mapF))
	}

	each(eachF: (row: any) => void) {
		each(this.data, eachF)
	}

	minValue(key : any) {
		return min(map(this.data, key))
	}

	maxValue(key : any) {
		return max(map(this.data, key))
	}

	first(key? : any) {
		if (key == null)
			return first(this.data)
		else
			return (find(this.data, (d: any) => d[key] !== undefined)||{})[key]
	}

	last(key? : any) {
		if (key == null)
			return last(this.data)
//		else
//			return (find(this.data, (d) => d[key] !== undefined)||{})[key]
	}

	toArray() {
		return this.data
	}

	pluck(key : any) {
		return map(this.data, key)
	}
}