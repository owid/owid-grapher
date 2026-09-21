import {
    RawEntityYears,
    RawMigrantDemographicsMetadata,
    RawYearRecord,
} from "./types.js"

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
export const RECORD_WITHOUT_POPULATION = {
    m: [1, 2],
    f: [3, 4],
} as RawYearRecord

export const METADATA: RawMigrantDemographicsMetadata = {
    meta: { title: "t", source: "s", unit: "persons" },
    ageBands: ["0-4", "5+"],
    years: [2010, 2020],
    entities: [
        { code: 840, name: "United States" },
        { code: 404, name: "Kenya" },
    ],
}

export const UNITED_STATES_YEARS: RawEntityYears = {
    "2010": RECORD,
    "2020": { m: [5, 10], f: [10, 25], pm: [50, 50], pf: [50, 50] },
}

// Natives heavily concentrated in one band (share 100% > any migrant share)
export const KENYA_YEARS: RawEntityYears = {
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
}
