import { RawEntity, RawMigrantDemographics, RawYearRecord } from "./types.js"

export const RECORD: RawYearRecord = {
    m: [10, 20],
    f: [30, 40],
    pm: [100, 120],
    pf: [130, 140],
}

/**
 * A migrant stock with no total population, as the UN used to report for small
 * territories. Asserted rather than typed, because the point of the fixture is
 * a file that violates the shape we now require.
 */
const RECORD_WITHOUT_POPULATION = { m: [1, 2], f: [3, 4] } as RawYearRecord

const WITHOUT_POPULATION_DATA: RawEntity = {
    name: "Monaco",
    data: {
        "2010": RECORD_WITHOUT_POPULATION,
        "2020": RECORD_WITHOUT_POPULATION,
    },
}

export const RAW: RawMigrantDemographics = {
    meta: { title: "t", source: "s", unit: "persons" },
    ageBands: ["0-4", "5+"],
    years: [2010, 2020],
    entities: [
        {
            name: "World",
            data: { "2010": RECORD, "2020": RECORD },
        },
        {
            name: "United States",
            data: {
                "2010": RECORD,
                "2020": { m: [5, 10], f: [10, 25], pm: [50, 50], pf: [50, 50] },
            },
        },
        // Natives heavily concentrated in one band (share 100% > any
        // migrant share)
        {
            name: "Kenya",
            data: {
                "2010": {
                    m: [10, 10],
                    f: [10, 10],
                    pm: [110, 10],
                    pf: [10, 10],
                },
                "2020": {
                    m: [10, 10],
                    f: [10, 10],
                    pm: [110, 10],
                    pf: [10, 10],
                },
            },
        },
        WITHOUT_POPULATION_DATA,
        // Malformed: missing a year
        { name: "Broken", data: { "2010": RECORD } },
    ],
}
