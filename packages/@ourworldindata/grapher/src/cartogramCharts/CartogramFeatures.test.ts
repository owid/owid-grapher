/// <reference types="node" />

import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"
import { buildCartogramLayout, parseCartogramCsv } from "./CartogramFeatures"
import { findClosestCartogramLayout } from "./CartogramLayouts"
import { CARTOGRAM_DATA_ENTITY_OVERRIDES } from "./CartogramCountryCodes"

const readFixture = (): string =>
    readFileSync(
        join(process.cwd(), "public/cartograms/population/2023.csv"),
        "utf8"
    )

describe("cartogram layout parsing", () => {
    it("parses the 2023 population cartogram CSV", () => {
        const cells = parseCartogramCsv(readFixture())
        const countryCodes = new Set(cells.map((cell) => cell.countryCode))

        expect(cells).toHaveLength(16175)
        expect(countryCodes.size).toBe(186)
        expect(Math.min(...cells.map((cell) => cell.x))).toBe(0)
        expect(Math.max(...cells.map((cell) => cell.x))).toBe(349)
        expect(Math.min(...cells.map((cell) => cell.y))).toBe(0)
        expect(Math.max(...cells.map((cell) => cell.y))).toBe(133)
    })

    it("builds entity features with paths and flipped y coordinates", () => {
        const cells = parseCartogramCsv(readFixture())
        const layout = buildCartogramLayout({
            year: 2023,
            url: "/cartograms/population/2023.csv",
            cells,
        })
        const featuresByName = new Map(
            layout.features.map((feature) => [feature.id, feature])
        )

        expect(layout.features).toHaveLength(186)
        expect(featuresByName.get("India")?.cells).toHaveLength(2876)
        expect(featuresByName.get("China")?.cells).toHaveLength(2845)
        expect(featuresByName.get("United States")?.cells).toHaveLength(687)
        expect(featuresByName.get("India")?.population).toBe(1_438_000_000)
        expect(featuresByName.get("India")?.fillPath.length).toBeGreaterThan(0)
        expect(featuresByName.get("India")?.outlinePath.length).toBeGreaterThan(
            0
        )
        expect(layout.bounds.x).toBe(0)
        expect(layout.bounds.y).toBe(0)
        expect(layout.bounds.width).toBe(350)
        expect(layout.bounds.height).toBe(134)
    })

    it("defines intended parent-data fallbacks", () => {
        expect(CARTOGRAM_DATA_ENTITY_OVERRIDES["Hong Kong"]).toBe("China")
        expect(CARTOGRAM_DATA_ENTITY_OVERRIDES["Macao"]).toBe("China")
        expect(CARTOGRAM_DATA_ENTITY_OVERRIDES["Reunion"]).toBe("France")
    })
})

describe("cartogram layout selection", () => {
    it("picks the closest available layout deterministically", () => {
        const layouts = [
            { year: 1950, url: "/1950.csv" },
            { year: 2000, url: "/2000.csv" },
            { year: 2023, url: "/2023.csv" },
        ]

        expect(findClosestCartogramLayout(1940, layouts).year).toBe(1950)
        expect(findClosestCartogramLayout(2010, layouts).year).toBe(2000)
        expect(findClosestCartogramLayout(2012, layouts).year).toBe(2023)
        expect(findClosestCartogramLayout(1975, layouts).year).toBe(2000)
    })
})
