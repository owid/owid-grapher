import { atom, type Atom } from "jotai"
import { unwrap } from "jotai/utils"
import { atomEffect } from "jotai-effect"
import {
    DEFAULT_YEAR,
    DETECT_COUNTRY_URL,
    INCOME_DISTRIBUTION_URL,
    INT_DOLLAR_CONVERSIONS_URL,
    INT_DOLLAR_CONVERSION_KEY_INFO,
    TIME_INTERVAL_FACTORS,
    TIME_INTERVALS,
    WORLD_ENTITY_NAME,
    type TimeInterval,
} from "./utils/incomePlotConstants.ts"
import type {
    IntDollarConversions,
    DetectCountryResponse,
    IntDollarConversionKeyInfo,
    IncomeDistributionDataFile,
    IncomeDistributionCountryData,
} from "./types.ts"
import {
    assignColors,
    formatCurrency,
    kdeLog,
    REGION_COLORS,
} from "./utils/incomePlotUtils.ts"
import * as R from "remeda"

type LoadableState<Value> =
    | { state: "loading" }
    | { state: "hasData"; data: Value }
    | { state: "hasError"; error: unknown }

const loadableAtom = <Value>(anAtom: Atom<Value>) => {
    const loading = Symbol("loading")
    const unwrappedAtom = unwrap(anAtom, () => loading)
    return atom((get): LoadableState<Awaited<Value>> => {
        try {
            const data = get(unwrappedAtom)
            if (data === loading) return { state: "loading" }
            return { state: "hasData", data: data as Awaited<Value> }
        } catch (error) {
            return { state: "hasError", error }
        }
    })
}

export const atomisNarrow = atom(false)

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
export const atomPovertyLineForLegend = atom((get) => {
    const line = get(atomCustomPovertyLine)
    const isNarrow = get(atomisNarrow)
    if (line === null && isNarrow) return 3
    return line
})
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
    // Set a specific time interval, or advance to the next one if none given
    (get, set, newValue?: TimeInterval) => {
        if (newValue !== undefined) {
            const idx = TIME_INTERVALS.indexOf(newValue)
            if (idx !== -1) set(atomTimeIntervalIdx, idx)
        } else {
            const idx = get(atomTimeIntervalIdx)
            set(atomTimeIntervalIdx, (idx + 1) % TIME_INTERVALS.length)
        }
    }
)

export const atomTimeIntervalFactor = atom((get) => {
    const idx = get(atomTimeIntervalIdx)
    return TIME_INTERVAL_FACTORS[idx]
})

const atomCountriesOrRegionsModeInternal = atom<"countries" | "regions">(
    "countries"
)
export const atomCountriesOrRegionsMode = atom(
    (get) => {
        const isSingleCountryMode = get(atomIsInSingleCountryMode)
        if (isSingleCountryMode) return "countries"
        return get(atomCountriesOrRegionsModeInternal)
    },
    (get, set, newValue?: "countries" | "regions") => {
        if (newValue !== undefined) {
            set(atomCountriesOrRegionsModeInternal, newValue)
        } else {
            set(atomCountriesOrRegionsModeInternal, (current) =>
                current === "countries" ? "regions" : "countries"
            )
        }
    }
)

// Data

export const atomRawDataForYear = atom<
    Promise<IncomeDistributionCountryData[]>
>(async (get, { signal }) => {
    const year = get(atomCurrentYear)
    const url = INCOME_DISTRIBUTION_URL.replace("<YEAR>", year.toString())
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`Failed to fetch income data: ${res.status}`)
    const rawData = (await res.json()) as IncomeDistributionDataFile
    const rawDataForYear = Object.values(rawData.data)
    const sortedDataForYear = R.sortBy(
        rawDataForYear,
        [R.prop("region"), "desc"],
        [R.prop("totalPopulation"), "desc"]
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
            pop: record.totalPopulation,
        }
        const kdeRes = kdeLog(record.avgs.map(Math.log2))
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

// Currency conversion data (incl. country detection)
export const atomIntDollarConversions = atom(async () => {
    try {
        const res = await fetch(INT_DOLLAR_CONVERSIONS_URL)
        const data = (await res.json()) as IntDollarConversions
        return data.filter((c) => c.currency_code)
    } catch {
        return undefined
    }
})

export const atomDetectedCountry = atom(async () => {
    try {
        const res = await fetch(DETECT_COUNTRY_URL)
        return (await res.json()) as DetectCountryResponse
    } catch {
        return undefined
    }
})

export const atomLocalCurrencyConversion = atom(async (get) => {
    const conversions = await get(atomIntDollarConversions)
    const detectedCountry = await get(atomDetectedCountry)
    const countryCode = detectedCountry?.country?.code
    if (!countryCode) return null

    const conversion = conversions?.find((c) => c.country_code === countryCode)
    if (!conversion) return null

    return conversion
})

// Legend
export const atomLegendEntries = atom((get) => {
    const currentEntities = get(atomCurrentEntitiesSorted)
    const entityColors = get(atomEntityColorMap)
    const hasPovertyLine = get(atomPovertyLineForLegend) !== null
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
export const atomCurrentCurrency = atom<IntDollarConversionKeyInfo>(
    INT_DOLLAR_CONVERSION_KEY_INFO
)

export const atomCurrentCurrencyFactor = atom((get) => {
    const currency = get(atomCurrentCurrency)
    return currency.conversion_factor
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

const atomCountrySelection = atom<string[]>([
    "China",
    "United States",
    "India",
    "Nigeria",
])
export const atomSelectedCountryNames = atom(
    (get) => {
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

export const atomCurrentTab = atom<"global" | "countries">("global")

export const atomIsInSingleCountryMode = atom((get) => {
    return get(atomCurrentTab) === "countries"
})

export const atomCurrentEntitiesSorted = atom((get) => {
    const isSingleCountryMode = get(atomIsInSingleCountryMode)
    const selectedCountryNames = get(atomSelectedCountryNames)

    if (isSingleCountryMode) {
        return selectedCountryNames.toSorted()
    } else {
        return Object.keys(REGION_COLORS)
    }
})

export const atomEntityColorMap = atom((get) => {
    const currentEntities = get(atomCurrentEntitiesSorted)
    return assignColors(currentEntities)
})

export const loadableIntDollarConversions = loadableAtom(
    atomIntDollarConversions
)
export const loadableLocalCurrencyConversion = loadableAtom(
    atomLocalCurrencyConversion
)
export const loadableDetectedCountry = loadableAtom(atomDetectedCountry)
export const loadableAvailableCountries = loadableAtom(
    atomAvailableCountryNames
)

const atomHasLocalCountryBeenIncludedInSelection = atom(false)
export const atomEffectIncludeLocalCountryInSelection = atomEffect(
    (get, set) => {
        const hasLocalCountryBeenIncluded = get(
            atomHasLocalCountryBeenIncludedInSelection
        )
        if (hasLocalCountryBeenIncluded) return

        const detectedCountry = get(loadableDetectedCountry)
        const availableCountries = get(loadableAvailableCountries)
        const selectedCountries = get(atomSelectedCountryNames)

        if (
            detectedCountry.state !== "hasData" ||
            availableCountries.state !== "hasData"
        )
            return
        const countryName = detectedCountry.data?.country?.name
        if (!countryName) return
        if (!availableCountries.data.includes(countryName)) return
        if (selectedCountries.includes(countryName)) return

        set(atomCountrySelection, [countryName, ...selectedCountries])
        set(atomHasLocalCountryBeenIncludedInSelection, true)
    }
)
