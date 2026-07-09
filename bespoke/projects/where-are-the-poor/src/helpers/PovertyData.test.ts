import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { HeadcountFileJson, POVERTY_LINES } from "./PovertyConstants.js"
import {
    getContinentForCountryName,
    getWbRegionForCountryName,
    parseHeadcountFile,
} from "./PovertyData.js"

const dataDir = fileURLToPath(new URL("../data", import.meta.url))

const dataFiles: HeadcountFileJson[] = POVERTY_LINES.map((line) =>
    JSON.parse(
        fs.readFileSync(
            path.join(dataDir, `headcounts-${line.cents}.json`),
            "utf-8"
        )
    )
)

describe("committed headcount data files", () => {
    it("has one data file per poverty line", () => {
        expect(dataFiles.map((file) => file.povertyLineCents)).toEqual(
            POVERTY_LINES.map((line) => line.cents)
        )
    })

    it("has identical country sets and years across files", () => {
        const [reference, ...rest] = dataFiles
        for (const file of rest) {
            expect(file.countries).toEqual(reference.countries)
            expect(file.years).toEqual(reference.years)
        }
    })

    it("has contiguous years", () => {
        const { years } = dataFiles[0]
        for (let i = 1; i < years.length; i++) {
            expect(years[i]).toBe(years[i - 1] + 1)
        }
    })

    it("maps every country to a continent and a World Bank region", () => {
        for (const countryName of dataFiles[0].countries) {
            expect
                .soft(
                    getContinentForCountryName(countryName),
                    `continent for "${countryName}"`
                )
                .toBeDefined()
            expect
                .soft(
                    getWbRegionForCountryName(countryName),
                    `World Bank region for "${countryName}"`
                )
                .toBeDefined()
        }
    })

    it("includes urban-only series as national data (Argentina) and no urban/rural variants", () => {
        const { countries } = dataFiles[0]
        expect(countries).toContain("Argentina")
        expect(countries).toContain("China")
        for (const countryName of countries) {
            expect(countryName).not.toMatch(/\((urban|rural)\)$/)
        }
    })

    it("has only non-negative headcounts", () => {
        for (const file of dataFiles) {
            for (const countryValues of file.values) {
                for (const value of countryValues) {
                    if (value !== null) expect(value).toBeGreaterThanOrEqual(0)
                }
            }
        }
    })
})

describe("parseHeadcountFile", () => {
    it("parses all countries and skips missing values", () => {
        const file = dataFiles[0]
        const rows = parseHeadcountFile(file)

        const numMissing = file.values
            .flat()
            .filter((value) => value === null).length
        expect(rows.length).toBe(
            file.countries.length * file.years.length - numMissing
        )

        const countries = new Set(rows.map((row) => row.countryName))
        expect(countries.size).toBe(file.countries.length)
    })

    it("attaches continent and World Bank region to every row", () => {
        const rows = parseHeadcountFile(dataFiles[0])
        for (const row of rows) {
            expect.soft(row.continent, row.countryName).toBeTruthy()
            expect.soft(row.wbRegion, row.countryName).toBeTruthy()
        }
    })
})
