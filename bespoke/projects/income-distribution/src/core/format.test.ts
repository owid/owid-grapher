import { describe, expect, it } from "vitest"

import {
    formatCountryList,
    formatPeople,
    formatShare,
    timeIntervalNoun,
} from "./format.js"

describe(timeIntervalNoun, () => {
    it("names the interval for a sentence", () => {
        expect(timeIntervalNoun("daily")).toBe("day")
        expect(timeIntervalNoun("monthly")).toBe("month")
        expect(timeIntervalNoun("yearly")).toBe("year")
    })
})

describe(formatShare, () => {
    it.each([
        [0.123, "12%"],
        [0.014, "1%"],
        [0.004, "<1%"],
        [0, "<1%"],
        [0.994, "99%"],
        [0.998, ">99%"],
        [1, ">99%"],
    ])("formats %f as %s", (share, expected) => {
        expect(formatShare(share)).toBe(expected)
    })
})

describe(formatPeople, () => {
    it.each([
        [3_712_000_000, "3.7 billion"],
        [999_600_000, "1 billion"],
        [567_000_000, "570 million"],
        [4_870_000, "4.9 million"],
        [849_000, "850,000"],
        [1234, "1,200"],
        [0, "0"],
    ])("formats %d as %s", (count, expected) => {
        expect(formatPeople(count)).toBe(expected)
    })
})

describe(formatCountryList, () => {
    it("joins names with commas and a final 'and'", () => {
        expect(formatCountryList(["Germany"])).toBe("Germany")
        expect(formatCountryList(["Germany", "China"])).toBe(
            "Germany and China"
        )
        expect(formatCountryList(["Germany", "China", "India"])).toBe(
            "Germany, China, and India"
        )
    })

    it("names countries as they read mid-sentence", () => {
        expect(formatCountryList(["India", "United States"])).toBe(
            "India and the United States"
        )
    })
})
