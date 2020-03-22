export interface CovidDatum {
    date: Date
    location: string
    totalCases: number | undefined
    totalDeaths: number | undefined
    newCases: number | undefined
    newDeaths: number | undefined
}

export type CovidSeries = CovidDatum[]

export interface CovidCountryDatum {
    id: string
    location: string
    series: CovidSeries
    latest: CovidDatum | undefined
    caseDoublingRange: CovidDoublingRange | undefined
    deathDoublingRange: CovidDoublingRange | undefined
}

export type CovidCountrySeries = CovidCountryDatum[]

export interface CovidDoublingRange {
    latestDay: CovidDatum
    halfDay: CovidDatum
    length: number
    ratio: number
}

export type DateRange = [Date, Date]

export enum CovidSortKey {
    location = "location",
    totalCases = "totalCases",
    newCases = "newCases",
    totalDeaths = "totalDeaths",
    newDeaths = "newDeaths",
    daysToDoubleCases = "daysToDoubleCases",
    daysToDoubleDeaths = "daysToDoubleDeaths"
}

export type CovidSortAccessor = (
    datum: CovidCountryDatum
) => string | number | undefined

export enum SortOrder {
    asc = "asc",
    desc = "desc"
}

export type NounKey = "cases" | "deaths" | "days"

export type NounGenerator = (n?: number) => string
