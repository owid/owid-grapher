import {keyBy} from './Util'
const fuzzysort = require("fuzzysort")

export default class FuzzySearch<T> {
    strings: string[]
    datamap: any

    constructor(data: T[], key: string) {
        this.datamap = keyBy(data, key)
        this.strings = data.map((d: any) => fuzzysort.prepare(d[key]))
    }

    search(input: string): T[] {
        return fuzzysort.go(input, this.strings).map((result: any) => this.datamap[result._target])
    }

    highlight(input: string, target: string): string {
        const result = fuzzysort.single(input, target)
        return result ? result.highlighted : target
    }
}
