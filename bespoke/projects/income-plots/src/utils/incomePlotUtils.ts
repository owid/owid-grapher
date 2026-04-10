import { roundSigFig } from "@ourworldindata/utils"
import * as fastKde from "fast-kde"
import {
    KDE_BANDWIDTH,
    KDE_EXTENT,
    KDE_NUM_BINS,
    TimeInterval,
    WORLD_ENTITY_NAME,
} from "./incomePlotConstants.ts"
import { type RawDataForYearRecord } from "../store.ts"
import * as R from "remeda"
import { IntDollarConversionKeyInfo } from "../types.ts"

const currencyFormatterCache = new Map<string, Intl.NumberFormat>()

export function formatCurrency(
    num: number,
    currency: IntDollarConversionKeyInfo,
    { formatShort }: { formatShort?: boolean } = {}
) {
    const currencyCode = currency.currency_code
    if (currencyCode === "INTD") {
        if (num >= 1_000_000) return "$" + Math.round(num / 1_000_000) + "M"
        if (num >= 1_000) return "$" + Math.round(num / 1_000) + "k"
        if (num >= 10) return "$" + roundSigFig(num, 2)
        if (num >= 1) {
            if (formatShort && Math.round(num) === num)
                return "$" + Math.round(num)
            return "$" + (Math.round(num * 10) / 10).toFixed(2)
        } else return "$" + R.round(num, 1).toFixed(2)
    }

    let formatter = currencyFormatterCache.get(currencyCode)
    if (!formatter) {
        formatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currencyCode,
            trailingZeroDisplay: "stripIfInteger",
            notation: "engineering",
            maximumSignificantDigits: 2,
        })
        currencyFormatterCache.set(currencyCode, formatter)
    }
    return formatter
        .format(num)
        .replace(/(\d\d)0?E-3$/, "0.$1")
        .replace(/E0$/, "")
        .replace(/E3$/, "k")
        .replace(/E6$/, "M")
        .replace(/E9$/, "B")
}

export function kdeLog(pointsLog2: number[]) {
    const k = fastKde.density1d(pointsLog2, {
        bandwidth: KDE_BANDWIDTH,
        extent: KDE_EXTENT,
        bins: KDE_NUM_BINS,
    })
    return [...k.points()].map((p) => ({
        ...p,
        x: Math.pow(2, p.x),
    })) as Array<{ x: number; y: number }>
}

// copied from CustomSchemes.ts
const OwidDistinctColors = {
    Purple: "#6d3e91",
    DarkOrange: "#c05917",
    LightTeal: "#58ac8c",
    Blue: "#286bbb",
    Maroon: "#883039",
    Camel: "#bc8e5a",
    MidnightBlue: "#00295b",
    DustyCoral: "#c15065",
    DarkOliveGreen: "#18470f",
    DarkCopper: "#9a5129",
    Peach: "#e56e5a",
    Mauve: "#a2559c",
    Turquoise: "#38aaba",
    OliveGreen: "#578145",
    Cherry: "#970046",
    Teal: "#00847e",
    RustyOrange: "#b13507",
    Denim: "#4c6a9c",
    Fuchsia: "#cf0a66",
    TealishGreen: "#00875e",
    Copper: "#b16214",
    DarkMauve: "#8c4569",
    Lime: "#3b8e1d",
    Coral: "#d73c50",
} as const

export const WORLD_COLOR = OwidDistinctColors.Purple

const COLOR_ROTATION = [
    OwidDistinctColors.Turquoise,
    OwidDistinctColors.Denim,
    OwidDistinctColors.DustyCoral,
    OwidDistinctColors.Camel,
    OwidDistinctColors.Peach,
    OwidDistinctColors.TealishGreen,
    OwidDistinctColors.Mauve,
]

export const REGION_COLORS = {
    "East Asia and Pacific": OwidDistinctColors.Turquoise,
    "Europe and Central Asia": OwidDistinctColors.Denim,
    "Latin America and Caribbean": OwidDistinctColors.DustyCoral,
    "Middle East, North Africa, Afghanistan and Pakistan":
        OwidDistinctColors.Camel,
    "North America": OwidDistinctColors.Peach,
    "South Asia": OwidDistinctColors.TealishGreen,
    "Sub-Saharan Africa": OwidDistinctColors.Mauve,
}

export const REGION_NAMES = Object.keys(REGION_COLORS)
const REGION_NAME_SET = new Set(REGION_NAMES)

export const assignColors = (arr: string[]) => {
    const map = new Map<string, string>(
        arr.map((entity, index) => [
            entity,
            COLOR_ROTATION[index % COLOR_ROTATION.length],
        ])
    )
    map.set(WORLD_ENTITY_NAME, WORLD_COLOR)
    return map
}

export const computePercentageBelowLine = (
    rawData: RawDataForYearRecord[],
    line: number,
    countriesOrRegions: Set<string>
) => {
    const lineInLog2 = Math.log2(line)
    const requestedCountries = new Set<string>()
    const requestedRegions = new Set<string>()
    const requestedWorld = countriesOrRegions.has(WORLD_ENTITY_NAME)

    for (const entity of countriesOrRegions) {
        if (entity === WORLD_ENTITY_NAME) continue
        if (REGION_NAME_SET.has(entity)) requestedRegions.add(entity)
        else requestedCountries.add(entity)
    }

    const totalsByEntity: Record<
        string,
        { totalPop: number; populationBelowLine: number }
    > = {}
    const addContribution = (
        entity: string,
        pop: number,
        populationBelowLine: number
    ) => {
        const record = (totalsByEntity[entity] ??= {
            totalPop: 0,
            populationBelowLine: 0,
        })

        record.totalPop += pop
        record.populationBelowLine += populationBelowLine
    }

    for (const record of rawData) {
        const pop = record.pop
        const matchesWorld = requestedWorld
        const matchesRegion = requestedRegions.has(record.region)
        const matchesCountry = requestedCountries.has(record.country)

        if (!matchesWorld && !matchesRegion && !matchesCountry) continue

        // SortedIndex finds the highest point that is lower than the set line, and so we can compute the number of people living below the line, in order to then compute the percentage of people living below the line for each entity and region (totalPopulationBelowLine / totalPopulation).
        const index = R.sortedIndex(record.avgsLog2, lineInLog2)
        const populationBelowLine = (index / 10) * pop

        if (matchesWorld) {
            addContribution(WORLD_ENTITY_NAME, pop, populationBelowLine)
        }
        if (matchesRegion) {
            addContribution(record.region, pop, populationBelowLine)
        }
        if (matchesCountry) {
            addContribution(record.country, pop, populationBelowLine)
        }
    }

    return new Map(
        [...countriesOrRegions].map((entity) => {
            const totals = totalsByEntity[entity]
            const percentageBelowLine = totals
                ? totals.populationBelowLine / totals.totalPop
                : NaN
            return [entity, percentageBelowLine]
        })
    )
}

export const getTimeIntervalStr = (interval: TimeInterval) => {
    switch (interval) {
        case "yearly":
            return "year"
        case "monthly":
            return "month"
        case "daily":
            return "day"
    }
}

export const roundPercentage = (num: number) => {
    if (num <= 1) return R.round(num, 1)
    else return Math.round(num)
}
