import { PrimitiveType } from "@ourworldindata/types"
import * as _ from "lodash-es"
import fuzzysort from "fuzzysort"

export class FuzzySearch<T> {
    strings: Fuzzysort.Prepared[]
    datamap: Record<string, T[]>
    uniqByFn: ((obj: T) => PrimitiveType) | undefined
    opts: Fuzzysort.Options | undefined

    private constructor(
        datamap: Record<string, T[]>,
        uniqByFn?: (obj: T) => PrimitiveType,
        opts?: Fuzzysort.Options
    ) {
        const rawStrings = Object.keys(datamap)
        this.strings = rawStrings.map((s) => fuzzysort.prepare(s))
        this.datamap = datamap
        this.uniqByFn = uniqByFn
        this.opts = opts
    }

    static withKey<T>(
        data: T[],
        keyFn: (obj: T) => string,
        opts?: Fuzzysort.Options
    ): FuzzySearch<T> {
        const datamap = _.groupBy(data, keyFn)
        return new FuzzySearch(datamap, undefined, opts)
    }

    // Allows for multiple keys per object, e.g. aliases:
    // [
    //     { name: "Netherlands", "keys": ["Netherlands", "Nederland"] },
    //     { name: "Spain", "keys": ["Spain", "España"] },
    // ]
    static withKeyArray<T>(
        data: T[],
        keysFn: (obj: T) => string[],
        uniqByFn?: (obj: T) => PrimitiveType,
        opts?: Fuzzysort.Options
    ): FuzzySearch<T> {
        const datamap: Record<string, T[]> = {}
        data.forEach((d) => {
            keysFn(d).forEach((key) => {
                if (!datamap[key]) datamap[key] = [d]
                else datamap[key].push(d)
            })
        })
        return new FuzzySearch(datamap, uniqByFn, opts)
    }

    search(input: string): T[] {
        const results = fuzzysort
            .go(input, this.strings, this.opts)
            .flatMap((result) => this.datamap[result.target])

        if (this.uniqByFn) {
            return _.uniqBy(results, this.uniqByFn)
        }
        return results
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
