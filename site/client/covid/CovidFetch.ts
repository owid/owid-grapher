import { csvParse } from "d3-dsv"
import moment from "moment"

import { CovidSeries } from "./CovidTypes"
import { fetchText, retryPromise } from "charts/Util"
import { ECDC_DATA_URL, TESTS_DATA_URL } from "./CovidConstants"
import { parseIntOrUndefined } from "./CovidUtils"

export async function fetchECDCData(): Promise<CovidSeries> {
    const responseText = await retryPromise(() => fetchText(ECDC_DATA_URL))
    const rows: CovidSeries = csvParse(responseText).map(row => {
        return {
            date: new Date(row.date as string),
            location: row.location as string,
            totalCases: parseIntOrUndefined(row.total_cases),
            totalDeaths: parseIntOrUndefined(row.total_deaths),
            newCases: parseIntOrUndefined(row.new_cases),
            newDeaths: parseIntOrUndefined(row.new_deaths)
        }
    })
    return rows
}

//      'Entity string'
//      'OWID country'
//      'Total tests/ individuals tested'
//      'Positive tests/ confirmed cases (refer to 'Remarks')'
//      'Date to which estimate refers (dd mmm yyyy)'
//      'Source URL'
//      'Source label'
//      'Date of source publication (dd mmm yyyy)'
//      'Time of source publication (hh:mm)'
// 'Timezone (keep same if multiple observations per day)'
//      'Remarks'
// 'Tests per million people'
//      'Population'
//      'Non-official / Non-verifiable (=1)'

export interface CovidTestsDatum {
    totalTests: number | undefined
    totalPositiveTests: number | undefined
    sourceURL: string | undefined
    sourceLabel: string | undefined
    publicationDate: Date
    remarks: string | undefined
    population: number | undefined
    nonOfficial: boolean
}

export async function fetchTestsData(): Promise<CovidSeries> {
    const responseText = await retryPromise(() => fetchText(TESTS_DATA_URL))
    const rows: CovidSeries = csvParse(responseText).map(row => {
        return {
            date: moment(
                row["Date to which estimate refers (dd mmm yyyy)"] as string,
                "DD MMMM YYYY"
            ).toDate(),
            location: row["Entity string"] as string,
            tests: {
                totalTests: parseIntOrUndefined(
                    row["Total tests/ individuals tested"]
                ),
                totalPositiveTests: parseIntOrUndefined(
                    row["Positive tests/ confirmed cases (refer to 'Remarks')"]
                ),
                sourceURL: row["Source URL"],
                sourceLabel: row["Source label"],
                publicationDate: moment(
                    `${row["Date of source publication (dd mmm yyyy)"]} ${row["Time of source publication (hh:mm)"]}`,
                    "DD MMMM YYYY HH:mm"
                ).toDate(),
                remarks: row["Remarks"],
                population: parseIntOrUndefined(row["Population"]),
                nonOfficial:
                    parseIntOrUndefined(
                        row["Non-official / Non-verifiable (=1)"]
                    ) === 1
            }
        }
    })
    return rows
}
