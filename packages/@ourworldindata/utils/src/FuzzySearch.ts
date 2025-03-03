import { groupBy } from "./Util.js"
import fuzzysort from "fuzzysort"

export class FuzzySearch<T> {
    strings: Fuzzysort.Prepared[]
    datamap: Record<string, T[]>
    opts: Fuzzysort.Options | undefined

    constructor(data: T[], key: keyof T, opts?: Fuzzysort.Options) {
        this.datamap = groupBy(data, key)
        this.strings = data.map((d) => fuzzysort.prepare(d[key] as string))
        this.opts = opts
    }

    search(input: string): T[] {
        return fuzzysort
            .go(input, this.strings, this.opts)
            .flatMap((result) => this.datamap[result.target])
    }

    searchResults(input: string): Fuzzysort.Results {
        return fuzzysort.go(input, this.strings, this.opts)
    }

    single(input: string, target: string): Fuzzysort.Result | null {
        return fuzzysort.single(input, target)
    }
}

type FuzzySearchResult = Fuzzysort.Result
export { type FuzzySearchResult }
