import { dateDiffInDays } from "charts/Util"
import moment from "moment"
import { ParsedCovidRow, MetricKind } from "./CovidTypes"
import { OwidVariable } from "charts/owidData/OwidVariable"
import { populationMap } from "./CovidPopulationMap"
import { variablePartials } from "./CovidVariablePartials"
import { csv } from "d3"

// Todo: cleanup
const keepStrings = new Set(`iso_code location date tests_units`.split(" "))

const parseRow = (row: any) => {
    Object.keys(row).forEach(key => {
        const isNumeric = !keepStrings.has(key)
        if (isNumeric) row[key] = row[key] ? parseFloat(row[key]) : 0
    })
    return row
}

const EPOCH_DATE = "2020-01-21"

const dateToYear = (dateString: string): number =>
    dateDiffInDays(
        moment.utc(dateString).toDate(),
        moment.utc(EPOCH_DATE).toDate()
    )

export declare type RowAccessor = (row: ParsedCovidRow) => number

// const localCsvPath = "http://localhost:3099/owid-covid-data.csv"
const csvPath = "https://covid.ourworldindata.org/data/owid-covid-data.csv"

export const fetchAndParseData = async (): Promise<ParsedCovidRow[]> => {
    const rawData = await csv(csvPath)
    return rawData.map(parseRow)
}

// Rolling average

export const buildCovidVariable = (
    name: MetricKind,
    countryMap: Map<any, any>,
    data: ParsedCovidRow[],
    rowFn: RowAccessor,
    perCapita?: number
): OwidVariable => {
    const filtered = data.filter(rowFn)
    const years = filtered.map(row => dateToYear(row.date))
    let values = filtered.map(rowFn)
    const entities = filtered.map(row => countryMap.get(row.location))
    if (perCapita)
        values = filtered.map((row, index) => {
            const pop = populationMap[row.location]
            const value = rowFn(row)
            return perCapita * (value / pop)
        })

    const variable: Partial<OwidVariable> = {
        ...variablePartials[name],
        years,
        entities,
        values
    }

    return variable as OwidVariable
}
