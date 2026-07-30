import { describe, it, expect } from "vitest"
import {
    WORLD_CODE,
    compareLabel,
    isValidCompareCode,
} from "./catalog.js"

describe("compareLabel", () => {
    it("names the prominent region entities", () => {
        expect(compareLabel(WORLD_CODE)).toBe("World")
    })
    it("falls back to the country's own name", () => {
        expect(compareLabel("DEU")).toBe("Germany")
    })
})

describe("isValidCompareCode", () => {
    it("accepts World for any country", () => {
        expect(isValidCompareCode("USA", WORLD_CODE)).toBe(true)
    })
    it("accepts another country as a comparison", () => {
        expect(isValidCompareCode("USA", "DEU")).toBe(true)
    })
    it("rejects comparing a country against itself", () => {
        expect(isValidCompareCode("DEU", "DEU")).toBe(false)
    })
    it("rejects an unknown code", () => {
        expect(isValidCompareCode("USA", "NOT_A_CODE")).toBe(false)
    })
})
