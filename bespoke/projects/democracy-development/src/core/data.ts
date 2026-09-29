import {
    useQueries,
    useQuery,
    type UseQueryResult,
} from "@tanstack/react-query"

import type {
    EntityName,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"
import { fetchJson, getContinentForCountry } from "@ourworldindata/utils"

import {
    DATA_API_URL,
    DEMOCRACY_VARIABLE_ID,
    INDICATOR_SPECS,
    POPULATION_VARIABLE_ID,
} from "./constants.js"
import type { IndicatorData, IndicatorKey, IndicatorSeries } from "./types.js"

const queryKeys = {
    indicator: (variableId: number) => [
        "democracy-development",
        "indicator",
        variableId,
    ],
}

/**
 * Fetch one indicator from the public data API and reshape its parallel
 * arrays into per-country series, sorted by year.
 *
 * Only countries are kept: the API files also carry regional aggregates
 * ("World", "Sub-Saharan Africa (WB)") and sub-national splits ("China
 * (urban)"), which don't belong in a country scatter. An entity counts as a
 * country when OWID's region list places it on a continent — that continent
 * is also what colours the dot.
 */
async function fetchIndicator(variableId: number): Promise<IndicatorData> {
    const [data, metadata] = await Promise.all([
        fetchJson<OwidVariableMixedData>(
            `${DATA_API_URL}${variableId}.data.json`
        ),
        fetchJson<OwidVariableWithSourceAndDimension>(
            `${DATA_API_URL}${variableId}.metadata.json`
        ),
    ])

    const entityNamesById = new Map<number, EntityName>()
    for (const entity of metadata.dimensions.entities.values) {
        if (entity.name) entityNamesById.set(entity.id, entity.name)
    }

    const byEntity = new Map<EntityName, IndicatorSeries>()
    const isCountry = new Map<EntityName, boolean>()
    let minYear = Infinity
    let maxYear = -Infinity

    for (let i = 0; i < data.values.length; i++) {
        const value = data.values[i]
        if (typeof value !== "number" || !Number.isFinite(value)) continue
        const entityName = entityNamesById.get(data.entities[i])
        if (!entityName) continue

        let keep = isCountry.get(entityName)
        if (keep === undefined) {
            keep = getContinentForCountry(entityName) !== undefined
            isCountry.set(entityName, keep)
        }
        if (!keep) continue

        const year = data.years[i]
        let series = byEntity.get(entityName)
        if (!series) {
            series = { years: [], values: [] }
            byEntity.set(entityName, series)
        }
        series.years.push(year)
        series.values.push(value)
        if (year < minYear) minYear = year
        if (year > maxYear) maxYear = year
    }

    // The API doesn't guarantee year order within an entity
    for (const series of byEntity.values()) sortSeriesByYear(series)

    return {
        byEntity,
        metadata: {
            name: metadata.name ?? "",
            attributions: getAttributions(metadata),
            minYear,
            maxYear,
        },
    }
}

function sortSeriesByYear(series: IndicatorSeries): void {
    const order = series.years
        .map((year, index) => ({ year, index }))
        .sort((a, b) => a.year - b.year)
    series.years = order.map((o) => series.years[o.index])
    series.values = order.map((o) => series.values[o.index])
}

/**
 * "V-Dem (2026)"-style attributions. The curated `presentation.attribution`
 * wins where the ETL set one, since it is written for a chart footer;
 * otherwise one entry per origin.
 */
function getAttributions(
    metadata: OwidVariableWithSourceAndDimension
): string[] {
    const curated = metadata.presentation?.attribution
    if (curated) return [curated]
    const fromOrigins = (metadata.origins ?? []).flatMap((origin) => {
        if (origin.attribution) return [origin.attribution]
        if (!origin.producer) return []
        const year = origin.datePublished?.slice(0, 4)
        return [year ? `${origin.producer} (${year})` : origin.producer]
    })
    if (fromOrigins.length > 0) return [...new Set(fromOrigins)]
    return metadata.source?.name ? [metadata.source.name] : []
}

function indicatorQueryOptions(variableId: number) {
    return {
        queryKey: queryKeys.indicator(variableId),
        queryFn: () => fetchIndicator(variableId),
        staleTime: Infinity,
    }
}

export function useDemocracyIndicator(): UseQueryResult<IndicatorData> {
    return useQuery(indicatorQueryOptions(DEMOCRACY_VARIABLE_ID))
}

export function useDevelopmentIndicators(): Record<
    IndicatorKey,
    UseQueryResult<IndicatorData>
> {
    const results = useQueries({
        queries: INDICATOR_SPECS.map((spec) =>
            indicatorQueryOptions(spec.variableId)
        ),
    })
    return Object.fromEntries(
        INDICATOR_SPECS.map((spec, i) => [spec.key, results[i]])
    ) as Record<IndicatorKey, UseQueryResult<IndicatorData>>
}

/** Population is only fetched once the reader turns on sizing */
export function usePopulationIndicator(
    enabled: boolean
): UseQueryResult<IndicatorData> {
    return useQuery({
        ...indicatorQueryOptions(POPULATION_VARIABLE_ID),
        enabled,
    })
}
