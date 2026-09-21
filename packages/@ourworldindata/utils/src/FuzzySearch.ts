import { PrimitiveType } from "@ourworldindata/types"
import * as _ from "lodash-es"
import fuzzysort from "fuzzysort"

// Structural mirrors of fuzzysort's types: fuzzysort only declares a global
// `Fuzzysort` ambient namespace, which isn't in scope for consumers of our
// published packages, so the exported API surface must not reference it.
export interface FuzzySearchResult {
    /** 1 is a perfect match. 0.5 is a good match. 0 is no match. */
    readonly score: number
    /** Your original target string */
    readonly target: string
    readonly indexes: ReadonlyArray<number>
    highlight(highlightOpen?: string, highlightClose?: string): string
    highlight<T>(callback: (match: string, index: number) => T): (string | T)[]
}

export interface FuzzySearchResults extends ReadonlyArray<FuzzySearchResult> {
    /** Total matches before limit */
    readonly total: number
}

export interface FuzzySearchOptions {
    /** Don't return matches worse than this (higher is faster) */
    threshold?: number
    /** Don't return more results than this (lower is faster) */
    limit?: number
    /** If true, returns all results for an empty search */
    all?: boolean
}

export interface FuzzySearchPrepared {
    /** Your original target string */
    readonly target: string
}

export class FuzzySearch<T> {
    strings: FuzzySearchPrepared[]
    datamap: Record<string, T[]>
    uniqByFn: ((obj: T) => PrimitiveType) | undefined
    opts: FuzzySearchOptions | undefined

    private constructor(
        datamap: Record<string, T[]>,
        uniqByFn?: (obj: T) => PrimitiveType,
        opts?: FuzzySearchOptions
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
        opts?: FuzzySearchOptions
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
        opts?: FuzzySearchOptions
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

    searchResults(input: string): FuzzySearchResults {
        return fuzzysort.go(input, this.strings, this.opts)
    }

    single(input: string, target: string): FuzzySearchResult | null {
        return fuzzysort.single(input, target)
    }
}
