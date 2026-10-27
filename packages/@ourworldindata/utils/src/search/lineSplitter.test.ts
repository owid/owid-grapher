import { describe, expect, it } from "vitest"
import { createLineSplitter } from "./lineSplitter.js"

describe(createLineSplitter, () => {
    it("emits complete lines across chunks and the trailing line on flush", () => {
        const lines: string[] = []
        const splitter = createLineSplitter((line) => lines.push(line))
        splitter.push('{"a":')
        splitter.push('1}\n{"b"')
        expect(lines).toEqual(['{"a":1}'])
        splitter.push(":2}")
        splitter.flush()
        expect(lines).toEqual(['{"a":1}', '{"b":2}'])
    })

    it("drops a partial line on reset", () => {
        const lines: string[] = []
        const splitter = createLineSplitter((line) => lines.push(line))
        splitter.push('{"half":')
        splitter.reset()
        splitter.push('{"whole":1}\n')
        expect(lines).toEqual(['{"whole":1}'])
    })
})
