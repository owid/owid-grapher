import { groupBy } from "./Util.js"
import fuzzysort from "fuzzysort"

export class FuzzySearch<T> {
    strings: Fuzzysort.Prepared[]
    datamap: Record<string, T[]>
    opts: Fuzzysort.Options | undefined

    private constructor(
        datamap: Record<string, T[]>,
        opts?: Fuzzysort.Options
    ) {
        const rawStrings = Object.keys(datamap)
        this.strings = rawStrings.map((s) => fuzzysort.prepare(s))
        this.datamap = datamap
        this.opts = opts
    }

    static withKey<T>(
        data: T[],
        key: (obj: T) => string,
        opts?: Fuzzysort.Options
    ): FuzzySearch<T> {
        const datamap = groupBy(data, key)
        return new FuzzySearch(datamap, opts)
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
