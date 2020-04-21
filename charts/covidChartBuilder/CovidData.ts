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

export const daysSinceVariable = (
    data: ParsedCovidRow[],
    countryMap: Map<any, any>
) => {
    const rows = data.filter(row => row.total_deaths >= 5)
    let currentCountry = ""
    let firstCountryDate = ""
    const dataWeNeed = rows.map(row => {
        if (row.location !== currentCountry) {
            currentCountry = row.location
            firstCountryDate = row.date
        }
        return {
            year: dateToYear(row.date),
            entity: countryMap.get(row.location),
            value: dateDiffInDays(
                moment.utc(row.date).toDate(),
                moment.utc(firstCountryDate).toDate()
            )
        }
    })

    const variable: Partial<OwidVariable> = {
        ...variablePartials.days_since_five,
        years: dataWeNeed.map(row => row.year),
        entities: dataWeNeed.map(row => row.entity),
        values: dataWeNeed.map(row => row.value)
    }

    return variable as OwidVariable
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
