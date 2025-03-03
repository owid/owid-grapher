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

    // Allows for multiple keys per object, e.g. aliases:
    // [
    //     { name: "Netherlands", "keys": ["Netherlands", "Nederland"] },
    //     { name: "Spain", "keys": ["Spain", "España"] },
    // ]
    // Note that the calling site will need to take care of uniqueness of results,
    // if that's desired, e.g. using uniqBy(results, "name")
    static withKeyArray<T>(
        data: T[],
        keys: (obj: T) => string[],
        opts?: Fuzzysort.Options
    ): FuzzySearch<T> {
        const datamap: Record<string, T[]> = {}
        data.forEach((d) => {
            keys(d).forEach((key) => {
                if (!datamap[key]) datamap[key] = [d]
                else datamap[key].push(d)
            })
        })
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
