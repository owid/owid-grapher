import { describe, expect, it } from "vitest"

import {
    computePyramidData,
    MigrantDemographicsMetadata,
    parseEntityYears,
} from "./data.js"
import {
    KENYA_YEARS,
    METADATA,
    RECORD,
    RECORD_WITHOUT_POPULATION,
    UNITED_STATES_YEARS,
} from "./testFixtures.js"

describe(computePyramidData, () => {
    it("derives native-born values and totals", () => {
        const data = computePyramidData(RECORD)
        expect(data.natives.men).toEqual([90, 100])
        expect(data.natives.women).toEqual([100, 100])
        expect(data.migrantsTotal).toEqual({ men: 30, women: 70, total: 100 })
        expect(data.nativesTotal).toEqual({ men: 190, women: 200, total: 390 })
    })

    it("clamps native-born values at zero", () => {
        const data = computePyramidData({
            m: [10],
            f: [0],
            pm: [5],
            pf: [0],
        })
        expect(data.natives.men).toEqual([0])
    })
})

describe(MigrantDemographicsMetadata, () => {
    const metadata = new MigrantDemographicsMetadata(METADATA)

    it("lists entity names in file order", () => {
        expect(metadata.entityNames).toEqual(["United States", "Kenya"])
    })

    it("knows which entities it has", () => {
        expect(metadata.hasEntity("United States")).toBe(true)
        expect(metadata.hasEntity("Broken")).toBe(false)
    })

    it("resolves an entity's code", () => {
        expect(metadata.getEntityCode("Kenya")).toBe(404)
        expect(metadata.getEntityCode("Broken")).toBeUndefined()
    })

    it("throws when the file is missing its age bands", () => {
        expect(
            () => new MigrantDemographicsMetadata({ ...METADATA, ageBands: [] })
        ).toThrow()
    })
})

describe(parseEntityYears, () => {
    const metadata = new MigrantDemographicsMetadata(METADATA)

    it("returns the year map for a well-formed entity", () => {
        expect(parseEntityYears(UNITED_STATES_YEARS, metadata)).toBe(
            UNITED_STATES_YEARS
        )
    })

    it("throws when a year's record is missing", () => {
        const missingYear = { "2020": UNITED_STATES_YEARS["2020"] }
        expect(() => parseEntityYears(missingYear, metadata)).toThrow(
            "missing a record for 2010"
        )
    })

    it("throws when a record has no total population", () => {
        expect(() =>
            parseEntityYears(
                {
                    "2010": RECORD_WITHOUT_POPULATION,
                    "2020": RECORD_WITHOUT_POPULATION,
                },
                metadata
            )
        ).toThrow("pm values")
    })

    it("throws when a band array is the wrong length", () => {
        expect(() =>
            parseEntityYears(
                {
                    "2010": { m: [1], f: [1, 2], pm: [1, 2], pf: [1, 2] },
                    "2020": KENYA_YEARS["2020"],
                },
                metadata
            )
        ).toThrow("m values")
    })
})
