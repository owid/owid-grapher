import { keyBy } from "clientUtils/Util"
import fuzzysort from "fuzzysort"

export class FuzzySearch<T> {
    strings: (Fuzzysort.Prepared | undefined)[]
    datamap: any

    constructor(data: T[], key: string) {
        this.datamap = keyBy(data, key)
        this.strings = data.map((d: any) => fuzzysort.prepare(d[key]))
    }

    search(input: string): T[] {
        return fuzzysort
            .go(input, this.strings)
            .map((result: any) => this.datamap[result.target])
    }

    single(input: string, target: string) {
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
