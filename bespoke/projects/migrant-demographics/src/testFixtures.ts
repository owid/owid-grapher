import { RawMigrantDemographics, RawYearRecord } from "./types.js"

export const RECORD: RawYearRecord = {
    m: [10, 20],
    f: [30, 40],
    pm: [100, 120],
    pf: [130, 140],
}

export const RAW: RawMigrantDemographics = {
    meta: { title: "t", source: "s", unit: "persons" },
    ageBands: ["0-4", "5+"],
    years: [2010, 2020],
    entities: [
        {
            code: 900,
            name: "WORLD",
            isAggregate: true,
            data: { "2010": RECORD, "2020": RECORD },
        },
        {
            code: 840,
            name: "United States of America",
            data: {
                "2010": RECORD,
                "2020": { m: [5, 10], f: [10, 25], pm: [50, 50], pf: [50, 50] },
            },
        },
        // Natives heavily concentrated in one band (share 100% > any
        // migrant share)
        {
            code: 404,
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
        // No total-population data, as the UN reports for small territories
        {
            code: 492,
            name: "Monaco",
            data: {
                "2010": { m: [1, 2], f: [3, 4] },
                "2020": { m: [1, 2], f: [3, 4] },
            },
        },
        // Malformed: missing a year
        { code: 1, name: "Broken", data: { "2010": RECORD } },
    ],
}
