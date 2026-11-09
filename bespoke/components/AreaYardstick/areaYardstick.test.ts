import { describe, expect, it } from "vitest"

import {
    audienceForCountry,
    describeArea,
    describeAreaBriefly,
    roundToNiceNumber,
} from "./areaYardstick.js"

const metric = audienceForCountry("DE")
const imperial = audienceForCountry("US")

function summarize(hectares: number, audience = metric): string {
    const d = describeArea(hectares, audience)!
    return [
        `${d.squareSide} × ${d.squareSide}`,
        d.count,
        d.comparison && `${d.comparison.phrase} ${d.comparison.reference.name}`,
        d.acres,
    ]
        .filter(Boolean)
        .join(" | ")
}

describe(audienceForCountry, () => {
    it("gives US visitors imperial units and American references", () => {
        expect(audienceForCountry("US")).toEqual({
            units: "imperial",
            references: "us",
        })
        expect(audienceForCountry("PR").units).toBe("imperial")
    })

    it("gives everyone else, and unknown visitors, metric and Europe", () => {
        for (const code of ["GB", "BR", "IN", undefined])
            expect(audienceForCountry(code)).toEqual({
                units: "metric",
                references: "europe",
            })
    })
})

describe(describeArea, () => {
    // One case per order of magnitude, from a few pitches to a continent
    it("reads naturally across the range for a metric audience", () => {
        expect(
            [
                3, 25, 400, 2_500, 11_900, 119_000, 640_000, 1_900_000,
                5_200_000, 28_000_000, 120_000_000,
            ].map((ha) => summarize(ha))
        ).toEqual([
            "150 m × 150 m | about 4 football pitches",
            "500 m × 500 m | about 35 football pitches",
            "2 km × 2 km | about twice the size of Monaco",
            "5 km × 5 km | about a quarter the size of the city of Paris",
            "10 km × 10 km | about the size of the city of Paris",
            "35 km × 35 km | a bit smaller than Greater London",
            "80 km × 80 km | a bit smaller than Cyprus",
            "150 km × 150 km | about the size of Wales",
            "250 km × 250 km | a bit larger than Switzerland",
            "500 km × 500 km | about the size of the United Kingdom",
            "1,000 km × 1,000 km | about the size of Egypt",
        ])
    })

    it("uses miles, feet, acres and American references for US visitors", () => {
        expect(summarize(3, imperial)).toBe(
            "600 feet × 600 feet | about 6 football fields | about 7 acres"
        )
        expect(summarize(119_000, imperial)).toBe(
            "20 miles × 20 miles | a bit larger than New York City | about 300,000 acres"
        )
        expect(summarize(28_000_000, imperial)).toBe(
            "350 miles × 350 miles | about the size of Michigan | about 70 million acres"
        )
    })

    it("has nothing to say about empty or invalid areas", () => {
        expect(describeArea(0)).toBeUndefined()
        expect(describeArea(-5)).toBeUndefined()
        expect(describeArea(NaN)).toBeUndefined()
    })
})

describe(describeAreaBriefly, () => {
    it("prefers a place and falls back to a pitch count", () => {
        expect(describeAreaBriefly(3_000_000)).toBe("About the size of Belgium")
        expect(describeAreaBriefly(25)).toBe("About 35 football pitches")
    })
})

describe(roundToNiceNumber, () => {
    it("rounds coarsely without floating point noise", () => {
        expect(roundToNiceNumber(34.5)).toBe(35)
        expect(roundToNiceNumber(0.31)).toBe(0.3)
        expect(roundToNiceNumber(1_190)).toBe(1_200)
    })
})
