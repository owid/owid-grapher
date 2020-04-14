import { keyBy } from "./Util"
import fuzzysort from "fuzzysort"

export class FuzzySearch<T> {
    strings: (Fuzzysort.Prepared | undefined)[]
    datamap: any

    constructor(data: T[], key: string) {
        this.datamap = keyBy(data, key)
        this.strings = data.map((d: any) => fuzzysort.prepare(d[key]))
    }

    search(input: string): T[] {
        console.log(fuzzysort.go(input, this.strings))
        return fuzzysort
            .go(input, this.strings)
            .map((result: any) => this.datamap[result.target])
    }

    highlight(input: string, target: string): string {
        const result = fuzzysort.single(input, target)
        return (result !== null && fuzzysort.highlight(result)) || target
    }
}
