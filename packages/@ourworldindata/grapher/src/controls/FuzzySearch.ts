import { keyBy } from "@ourworldindata/utils"
import fuzzysort from "fuzzysort"

export class FuzzySearch<T> {
    strings: (Fuzzysort.Prepared | undefined)[]
    datamap: Record<string, T>

    constructor(data: T[], key: keyof T) {
        this.datamap = keyBy(data, key)
        this.strings = data.map((d) => fuzzysort.prepare(d[key] as string))
    }

    search(input: string): T[] {
        return fuzzysort
            .go(input, this.strings)
            .map((result) => this.datamap[result.target])
    }

    single(input: string, target: string): Fuzzysort.Result | null {
        return fuzzysort.single(input, target)
    }

    highlight(input: string, target: string): string {
        const result = fuzzysort.single(input, target)
        return highlight(result) ?? target
    }
}

export function highlight(result: Fuzzysort.Result | null): string | null {
    // The type definition of fuzzysort.highlight is wrong: It won't accept `undefined` as input,
    // but will happily accept `null`. That's why we use this wrapper here so we can actually call it.
    // Don't call fuzzysort.highlight directly if the value can be null or undefined, since one will
    // result in a type error and the other in a runtime error!
    return fuzzysort.highlight(result!)
}
