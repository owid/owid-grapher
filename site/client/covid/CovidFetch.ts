import { csvParse } from "d3"

import { CovidSeries } from "./CovidTypes"
import { fetchText, retryPromise } from "charts/Util"
import { DATA_URL } from "./CovidConstants"
import { parseIntOrUndefined } from "./CovidUtils"

export async function fetchECDCData(): Promise<CovidSeries> {
    const responseText = await retryPromise(() => fetchText(DATA_URL))
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
