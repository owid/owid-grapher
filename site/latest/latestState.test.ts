import { describe, expect, it } from "vitest"
import {
    LatestState,
    searchParamsToState,
    stateToSearchParams,
} from "./latestState.js"

const ALL_AREAS = ["Health", "Energy", "Nutrition"]

const decode = (qs: string): LatestState =>
    searchParamsToState(new URLSearchParams(qs), ALL_AREAS)

const encode = (state: LatestState): string =>
    stateToSearchParams(state).toString()

describe("decoding /latest URL params", () => {
    it("decodes valid topics and type", () => {
        expect(decode("topics=Health~Energy&type=data-insight")).toEqual({
            topics: ["Health", "Energy"],
            latestType: "data-insight",
        })
    })

    it("drops unknown params", () => {
        expect(decode("foo=bar&type=data-insight")).toEqual({
            topics: [],
            latestType: "data-insight",
        })
    })

    it("drops legacy singular `topic` param from old /data-insights URLs", () => {
        expect(decode("topic=Health")).toEqual({
            topics: [],
            latestType: null,
        })
    })

    it("drops topics not in allAreas", () => {
        expect(decode("topics=Health~NotARealArea")).toEqual({
            topics: ["Health"],
            latestType: null,
        })
    })

    it("returns null latestType for unknown type values", () => {
        expect(decode("type=bogus")).toEqual({
            topics: [],
            latestType: null,
        })
    })

    it("returns empty defaults for an empty query string", () => {
        expect(decode("")).toEqual({ topics: [], latestType: null })
    })
})

describe("encoding /latest URL params", () => {
    it("omits empty topics and null latestType", () => {
        expect(encode({ topics: [], latestType: null })).toBe("")
    })

    it("emits only topics when latestType is null", () => {
        expect(encode({ topics: ["Health"], latestType: null })).toBe(
            "topics=Health"
        )
    })

    it("emits only type when topics is empty", () => {
        expect(encode({ topics: [], latestType: "data-insight" })).toBe(
            "type=data-insight"
        )
    })

    it("emits both when populated", () => {
        const out = encode({
            topics: ["Health", "Energy"],
            latestType: "article",
        })
        // URLSearchParams encodes ~ as %7E
        expect(out).toBe("topics=Health%7EEnergy&type=article")
    })
})

describe("decode → encode round trip", () => {
    it("strips unknown params on round trip", () => {
        const sanitized = encode(
            decode("foo=bar&topic=Health&type=data-insight")
        )
        expect(sanitized).toBe("type=data-insight")
    })

    it("strips invalid topics on round trip", () => {
        const sanitized = encode(decode("topics=Health~NotReal"))
        expect(sanitized).toBe("topics=Health")
    })

    it("strips invalid type on round trip", () => {
        expect(encode(decode("type=invalid"))).toBe("")
    })

    it("is idempotent", () => {
        const once = encode(decode("topics=Health~Energy&type=article&foo=bar"))
        const twice = encode(decode(once))
        expect(once).toBe(twice)
    })
})
