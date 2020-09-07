import { CovidTestsDatum } from "./CovidFetch"

export interface CovidDatum {
    date: Date
    location: string
    totalCases?: number
    totalDeaths?: number
    newCases?: number
    newDeaths?: number
    tests?: CovidTestsDatum
}

export type CovidSeries = CovidDatum[]

export interface CovidCountryDatum {
    id: string
    location: string
    series: CovidSeries
    latest: CovidDatum | undefined
    latestWithTests: CovidDatum | undefined
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
    daysToDoubleDeaths = "daysToDoubleDeaths",
    totalTests = "totalTests",
    testDate = "testDate",
}

export type CovidSortAccessor = (
    datum: CovidCountryDatum
) => Date | string | number | undefined

export type NounKey = "cases" | "deaths" | "tests" | "days"

export type NounGenerator = (n?: number) => string
