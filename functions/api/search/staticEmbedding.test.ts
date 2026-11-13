import { describe, expect, it } from "vitest"
import {
    bertWords,
    embedStatic,
    parseSafetensors,
    tokenIds,
    type StaticModel,
} from "./staticEmbedding.js"

describe(bertWords, () => {
    it("lowercases, strips accents and splits off punctuation", () => {
        expect(bertWords("Ünïcödé café, GDP/capita (PPP)!")).toEqual([
            "unicode",
            "cafe",
            ",",
            "gdp",
            "/",
            "capita",
            "(",
            "ppp",
            ")",
            "!",
        ])
    })

    it("treats CJK characters as words and drops control characters", () => {
        expect(bertWords("日本\u0000 population\tgrowth")).toEqual([
            "日",
            "本",
            "population",
            "growth",
        ])
    })
})

describe(tokenIds, () => {
    const vocab = new Map([
        ["under", 0],
        ["##nour", 1],
        ["##ish", 2],
        ["##ment", 3],
        ["child", 4],
        ["'", 5],
        ["s", 6],
    ])

    it("splits a word into its longest known pieces", () => {
        expect(tokenIds("undernourishment", vocab)).toEqual([0, 1, 2, 3])
    })

    it("drops a word it can't split whole, keeping the others", () => {
        expect(tokenIds("child's undernourishmentx", vocab)).toEqual([4, 5, 6])
    })
})

describe(embedStatic, () => {
    const model: StaticModel = {
        vocab: new Map([
            ["a", 0],
            ["b", 1],
        ]),
        vectors: new Float32Array([1, 0, 0, 3]),
        dims: 2,
    }

    it("averages the tokens' vectors", () => {
        expect(embedStatic(model, "a b")).toEqual([0.5, 1.5])
    })

    it("gives a zero vector when no token is known", () => {
        expect(embedStatic(model, "zzz")).toEqual([0, 0])
    })
})

describe(parseSafetensors, () => {
    const file = (header: object, values: number[], pad = ""): ArrayBuffer => {
        const json = new TextEncoder().encode(JSON.stringify(header) + pad)
        const buffer = new ArrayBuffer(8 + json.length + values.length * 4)
        new DataView(buffer).setBigUint64(0, BigInt(json.length), true)
        new Uint8Array(buffer, 8).set(json)
        const view = new DataView(buffer, 8 + json.length)
        values.forEach((v, i) => view.setFloat32(i * 4, v, true))
        return buffer
    }

    it("reads the table, also at an unaligned offset", () => {
        const header = {
            embeddings: { dtype: "F32", shape: [2, 2], data_offsets: [0, 16] },
        }
        // padding the header by 0–3 spaces moves the data across alignments
        for (const pad of ["", " ", "  ", "   "]) {
            const buffer = file(header, [1, 2, 3, 4], pad)
            const { vectors, rows, dims } = parseSafetensors(buffer)
            expect({ rows, dims, values: Array.from(vectors) }).toEqual({
                rows: 2,
                dims: 2,
                values: [1, 2, 3, 4],
            })
        }
    })

    it("rejects anything but one 2-D F32 tensor", () => {
        const buffer = file(
            { e: { dtype: "F16", shape: [2, 2], data_offsets: [0, 8] } },
            [0, 0]
        )
        expect(() => parseSafetensors(buffer)).toThrow("unexpected tensor")
    })
})
