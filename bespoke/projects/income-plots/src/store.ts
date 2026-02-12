import { atom } from "jotai"
import {
    CURRENCIES,
    CURRENCY_FACTORS,
    DEFAULT_YEAR,
    TIME_INTERVAL_FACTORS,
    TIME_INTERVALS,
    WORLD_ENTITY_NAME,
} from "./utils/incomePlotConstants.ts"
import data from "./data/incomeBins.json"
import { sleep } from "@ourworldindata/utils"
import {
    assignColors,
    formatCurrency,
    kdeLog,
    REGION_COLORS,
} from "./utils/incomePlotUtils.ts"
import * as R from "remeda"

export interface RawDataRecord {
    avgsLog2Times100: number[]
    country: string
    region: string
    year: number
    pop: number
}

export interface RawDataForYearRecord extends RawDataRecord {
    avgsLog2: number[]
}

const atomCustomPovertyLineInternal = atom(3)
export const atomShowCustomPovertyLine = atom(false)
export const atomCustomPovertyLine = atom(
    (get) => {
        const show = get(atomShowCustomPovertyLine)
        if (!show) return null
        return get(atomCustomPovertyLineInternal)
    },
    (get, set, newValue: number) => {
        set(atomCustomPovertyLineInternal, newValue)
    }
)
export const atomCustomPovertyLineFormatted = atom((get) => {
    const line = get(atomCustomPovertyLine)
    if (line === null) return null
    const currency = get(atomCurrentCurrency)
    const combinedFactor = get(atomCombinedFactor)
    return formatCurrency(line * combinedFactor, currency)
})

// Basic atoms related to data-display controls
export const atomCurrentYear = atom<number>(DEFAULT_YEAR)

const atomTimeIntervalIdx = atom(0)
export const atomTimeInterval = atom(
    (get) => {
        const idx = get(atomTimeIntervalIdx)
        return TIME_INTERVALS[idx]
    },
    // Advance to the next time interval
    (get, set) => {
        const idx = get(atomTimeIntervalIdx)
        const nextIdx = (idx + 1) % TIME_INTERVALS.length
        set(atomTimeIntervalIdx, nextIdx)
    }
)

export const atomTimeIntervalFactor = atom((get) => {
    const idx = get(atomTimeIntervalIdx)
    return TIME_INTERVAL_FACTORS[idx]
})

const atomCountriesOrRegionsModeInternal = atom<"countries" | "regions">(
    "regions"
)
export const atomCountriesOrRegionsMode = atom(
    (get) => get(atomCountriesOrRegionsModeInternal),
    (get, set) => {
        set(atomCountriesOrRegionsModeInternal, (current) =>
            current === "countries" ? "regions" : "countries"
        )
    }
)

// Data
export const atomRawDataForYear = atom(async (get, { signal }) => {
    const year = get(atomCurrentYear)

    const rawData = data as RawDataRecord[]

    await sleep(500)
    if (signal.aborted) return []

    const dataForYear = rawData
        .filter((d) => d.year === year)
        .map((d) => ({
            ...d,
            avgsLog2: d.avgsLog2Times100.map((v) => v / 100),
            pop: d.pop * 1000,
        })) as RawDataForYearRecord[]
    const sortedDataForYear = R.sortBy(
        dataForYear,
        [R.prop("region"), "desc"],
        [R.prop("pop"), "desc"]
    )
    return sortedDataForYear
})

export const atomCountryRegionMap = atom(async (get) => {
    const rawData = await get(atomRawDataForYear)

    return new Map(rawData.map((d) => [d.country, d.region]))
})

export const atomKdeDataForYear = atom(async (get) => {
    const rawData = await get(atomRawDataForYear)
    const kdeData = rawData.flatMap((record) => {
        const common = {
            country: record.country,
            region: record.region,
            year: record.year,
            pop: record.pop,
        }
        const kdeRes = kdeLog(record.avgsLog2)
        return kdeRes.map((kde) => ({
            ...common,
            ...kde,
            yScaledByPop: kde.y * common.pop,
        }))
    })

    return kdeData
})

export const atomKdeXValues = atom<Promise<[number, ...number[]]>>(
    async (get) => {
        const kdeData = await get(atomKdeDataForYear)
        return Array.from(new Set(kdeData.map((d) => d.x))) as [
            number,
            ...number[],
        ]
    }
)

export const atomKdeDataForYearGroupedByRegion = atom(async (get) => {
    const kdeData = await get(atomKdeDataForYear)

    const transformed = R.mapValues(
        R.groupBy(kdeData, (d) => `${d.region}-${d.x}`),
        (kdes) => {
            const first = kdes[0]
            return {
                ...first,
                country: null,
                pop: R.sumBy(kdes, (d) => d.pop),
                y: R.sumBy(kdes, (d) => d.y),
            }
        }
    )
    return Object.values(transformed)
})

// Legend
export const atomLegendEntries = atom((get) => {
    const currentEntities = get(atomCurrentEntitiesSorted)
    const entityColors = get(atomEntityColorMap)
    const hasPovertyLine = get(atomCustomPovertyLine) !== null
    const map = currentEntities.map((entity) => {
        const colorEntry = entityColors.get(entity)
        return {
            name: entity,
            color: colorEntry,
        }
    })
    if (hasPovertyLine)
        map.push({
            name: WORLD_ENTITY_NAME,
            color: entityColors.get(WORLD_ENTITY_NAME),
        })
    return map
})

// Hover state of the chart
export const atomHoveredEntity = atom<string | null>(null)
export const atomHoveredEntityType = atom((get) => {
    const hoveredEntity = get(atomHoveredEntity)
    if (!hoveredEntity) return null

    const regionNames = Object.keys(REGION_COLORS)
    const entry = regionNames.includes(hoveredEntity)
    if (entry) return "region"
    return "country"
})
export const atomHoveredX = atom<number | null>(null)

// Currency
const atomCurrenctCurrencyIdx = atom(0)
export const atomCurrentCurrency = atom(
    (get) => {
        const idx = get(atomCurrenctCurrencyIdx)
        return CURRENCIES[idx]
    },
    (get, set) => {
        set(atomCurrenctCurrencyIdx, (idx) => (idx + 1) % CURRENCIES.length)
    }
)

export const atomCurrentCurrencyFactor = atom((get) => {
    const currency = get(atomCurrentCurrency)
    return CURRENCY_FACTORS[currency]
})

export const atomCombinedFactor = atom((get) => {
    const timeIntervalFactor = get(atomTimeIntervalFactor)
    const currencyFactor = get(atomCurrentCurrencyFactor)
    return timeIntervalFactor * currencyFactor
})

export const atomTooltipIsOpen = atom((get) => {
    const hoveredX = get(atomHoveredX)
    return hoveredX !== null
})

export const atomIsInCountryMode = atom((get) => {
    const mode = get(atomCountriesOrRegionsMode)
    return mode === "countries"
})

const atomCountrySelection = atom<string[]>([])
export const atomSelectedCountryNames = atom(
    (get) => {
        if (!get(atomIsInCountryMode)) return []
        return get(atomCountrySelection)
    },
    (get, set, newValue: string[]) => {
        set(atomCountrySelection, newValue)
    }
)

export const atomAvailableCountryNames = atom(async (get) => {
    const rawData = await get(atomRawDataForYear)
    return rawData.map((d) => d.country).toSorted()
})

const atomSelectedOnly = atom(false)
export const atomIsInSingleCountryMode = atom(
    (get) => {
        const isInCountryMode = get(atomIsInCountryMode)
        if (!isInCountryMode) return false
        return get(atomSelectedOnly)
    },
    (get, set, newValue: boolean) => {
        set(atomSelectedOnly, newValue)
    }
)

export const atomCurrentEntitiesSorted = atom((get) => {
    const isSingleCountryMode = get(atomIsInSingleCountryMode)
    const selectedCountryNames = get(atomSelectedCountryNames)

    if (isSingleCountryMode) {
        return selectedCountryNames.toSorted()
    } else {
        return [...Object.keys(REGION_COLORS)]
    }
})

export const atomEntityColorMap = atom((get) => {
    const currentEntities = get(atomCurrentEntitiesSorted)
    return assignColors(currentEntities)
})
