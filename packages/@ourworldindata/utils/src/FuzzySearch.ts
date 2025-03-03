import { keyBy } from "./Util.js"
import fuzzysort from "fuzzysort"

export class FuzzySearch<T> {
    strings: Fuzzysort.Prepared[]
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
        return result?.highlight() ?? target
    }
}
