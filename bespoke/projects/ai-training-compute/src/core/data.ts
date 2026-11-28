import { QueryClient, useQuery, UseQueryResult } from "@tanstack/react-query"

import { fetchJson } from "@ourworldindata/utils"
import type { BespokeMetadata } from "@ourworldindata/types"

import { parseBespokeMetadata } from "../../../../components/MetadataModal/bespokeMetadata.js"
import modelConfidence from "../data/modelConfidence.json"

import {
    AiModel,
    ColorBy,
    MULTIDIM_CONFIG_URL,
    MULTIDIM_VIEWS,
} from "./constants.js"

export const queryClient = new QueryClient()

/** An indicator's values, as the OWID API serves them */
export interface IndicatorData {
    values: (number | string)[]
    years: number[]
    entities: number[]
}

/** The parts of an indicator's metadata the chart reads */
export interface IndicatorMetadata {
    display?: { zeroDay?: string }
    dimensions: { entities: { values: { id: number; name: string }[] } }
}

export interface MultidimConfig {
    views: {
        dimensions: Record<string, string>
        indicators: { y?: { id: number }[]; color?: { id: number } }
    }[]
}

/** The indicator ids the chart needs, read from the multidim's views */
export interface IndicatorIds {
    compute: number
    color: Record<ColorBy, number>
}

export function findIndicatorIds(config: MultidimConfig): IndicatorIds {
    const findView = (
        dimensions: Record<string, string>
    ): MultidimConfig["views"][number] | undefined =>
        config.views.find((view) =>
            Object.entries(dimensions).every(
                ([key, value]) => view.dimensions[key] === value
            )
        )
    const reporting = findView(MULTIDIM_VIEWS.reporting)
    const developer = findView(MULTIDIM_VIEWS.developer)
    const compute = reporting?.indicators.y?.[0]?.id
    const reportingColor = reporting?.indicators.color?.id
    const developerColor = developer?.indicators.color?.id
    if (!compute || !reportingColor || !developerColor)
        throw new Error("The multidim no longer has the expected views")
    return {
        compute,
        color: { reporting: reportingColor, developer: developerColor },
    }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * One model per value of the compute indicator, with the color indicators'
 * values for the same model and day. The confidence label isn't in the
 * OWID data yet, so it comes from a lookup by model name.
 */
export function joinIndicators({
    compute,
    computeMetadata,
    reporting,
    developer,
    confidenceByModel,
}: {
    compute: IndicatorData
    computeMetadata: IndicatorMetadata
    reporting: IndicatorData
    developer: IndicatorData
    confidenceByModel: ReadonlyMap<string, string>
}): AiModel[] {
    const entityNames = new Map(
        computeMetadata.dimensions.entities.values.map((e) => [e.id, e.name])
    )
    const zeroDay = Date.parse(
        `${computeMetadata.display?.zeroDay ?? "1949-01-01"}T00:00:00Z`
    )
    const byEntityAndDay = (data: IndicatorData): Map<string, string> =>
        new Map(
            data.entities.map((entity, i) => [
                `${entity}:${data.years[i]}`,
                String(data.values[i]),
            ])
        )
    const reportingByKey = byEntityAndDay(reporting)
    const developerByKey = byEntityAndDay(developer)

    return compute.entities.flatMap((entity, i) => {
        const value = Number(compute.values[i])
        const model = entityNames.get(entity)
        if (!model || !Number.isFinite(value) || value <= 0) return []
        const key = `${entity}:${compute.years[i]}`
        const date = new Date(zeroDay + compute.years[i] * DAY_MS)
        return [
            {
                model,
                date,
                year: toFractionalYear(date),
                trainingComputeFlop: value,
                reporting: reportingByKey.get(key),
                developer: developerByKey.get(key),
                confidence: confidenceByModel.get(model),
            },
        ]
    })
}

export function toFractionalYear(date: Date): number {
    const year = date.getUTCFullYear()
    const start = Date.UTC(year, 0, 1)
    const end = Date.UTC(year + 1, 0, 1)
    return year + (date.getTime() - start) / (end - start)
}

/** Epoch AI's confidence labels, from src/data/modelConfidence.json */
const CONFIDENCE_BY_MODEL: ReadonlyMap<string, string> = new Map(
    (modelConfidence as { model: string; confidence: string }[]).map(
        ({ model, confidence }) => [model, confidence]
    )
)

export interface ChartData {
    models: AiModel[]
    /** The compute indicator's metadata, for the source line and modal */
    metadata?: BespokeMetadata
}

/** Fetches the multidim's config, then its indicators, and joins them */
export async function fetchChartData(apiUrl: string): Promise<ChartData> {
    const ids = findIndicatorIds(
        await fetchJson<MultidimConfig>(MULTIDIM_CONFIG_URL)
    )
    const url = (id: number, kind: "data" | "metadata"): string =>
        `${apiUrl}/${id}.${kind}.json`
    const [compute, computeMetadata, reporting, developer] = await Promise.all([
        fetchJson<IndicatorData>(url(ids.compute, "data")),
        fetchJson<IndicatorMetadata>(url(ids.compute, "metadata")),
        fetchJson<IndicatorData>(url(ids.color.reporting, "data")),
        fetchJson<IndicatorData>(url(ids.color.developer, "data")),
    ])
    return {
        models: joinIndicators({
            compute,
            computeMetadata,
            reporting,
            developer,
            confidenceByModel: CONFIDENCE_BY_MODEL,
        }),
        metadata: parseBespokeMetadata(computeMetadata),
    }
}

export function useChartData(apiUrl: string): UseQueryResult<ChartData> {
    return useQuery({
        queryKey: ["ai-training-compute", apiUrl],
        queryFn: () => fetchChartData(apiUrl),
    })
}
