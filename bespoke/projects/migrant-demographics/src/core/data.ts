import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"
import * as R from "remeda"

import { fetchJson } from "@ourworldindata/utils"

import {
    PopulationTotals,
    PyramidData,
    RawEntityYears,
    RawMigrantDemographicsMetadata,
    RawYearRecord,
    SexValues,
} from "./types.js"

export const queryClient = new QueryClient()

export const useMigrantDemographicsMetadata = (
    metadataUrl: string
): {
    data?: MigrantDemographicsMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: ["migrant-demographics", "metadata"],
        queryFn: async (): Promise<MigrantDemographicsMetadata> => {
            const raw =
                await fetchJson<RawMigrantDemographicsMetadata>(metadataUrl)
            return new MigrantDemographicsMetadata(raw)
        },
        staleTime: Infinity, // The data files are immutable within a session
    })

    return { data: result.data, status: result.status }
}

export const useMigrantDemographicsEntity = (
    entityName: string,
    metadata: MigrantDemographicsMetadata | undefined,
    dataUrl: string
): {
    data?: RawEntityYears
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const code = metadata?.getEntityCode(entityName)
    const hasUnknownEntity = metadata !== undefined && code === undefined

    const result = useQuery({
        queryKey: ["migrant-demographics", "entity", code],
        queryFn: async (): Promise<RawEntityYears> => {
            const raw = await fetchJson<RawEntityYears>(
                `${dataUrl}/migrant-demographics.${code}.json`
            )
            return parseEntityYears(raw, metadata!)
        },
        enabled: code !== undefined,
        placeholderData: (previousData) => previousData,
        staleTime: Infinity,
    })

    return {
        data: result.data,
        status: hasUnknownEntity ? "error" : result.status,
        isPlaceholderData: result.isPlaceholderData,
    }
}

export class MigrantDemographicsMetadata {
    readonly ageBands: string[]
    readonly years: number[]
    readonly source: string
    /** Stable array so consumers can use it as a memo dependency */
    readonly entityNames: string[]
    private readonly codesByEntityName: Map<string, number>

    constructor(raw: RawMigrantDemographicsMetadata) {
        // Without these the chart's geometry degenerates to NaN, so fail into
        // the error state rather than rendering a broken pyramid
        if (!raw.ageBands?.length || !raw.years?.length || !raw.meta?.source)
            throw new Error(
                "[migrant-demographics] Data file is missing its age bands, years or source"
            )

        this.ageBands = raw.ageBands
        this.years = raw.years
        this.source = raw.meta.source

        this.codesByEntityName = new Map(
            raw.entities.map((entity) => [entity.name, entity.code])
        )
        this.entityNames = [...this.codesByEntityName.keys()]
    }

    hasEntity(name: string): boolean {
        return this.codesByEntityName.has(name)
    }

    getEntityCode(name: string): number | undefined {
        return this.codesByEntityName.get(name)
    }
}

/**
 * Derive the migrant and native-born populations from a raw year record.
 * Native-born = total resident population minus migrant stock, clamped at zero
 * so a bar can never render backwards should the two ever disagree.
 */
export function computePyramidData(record: RawYearRecord): PyramidData {
    const migrants = { men: record.m, women: record.f }
    const natives = {
        men: record.pm.map((p, i) => Math.max(0, p - record.m[i])),
        women: record.pf.map((p, i) => Math.max(0, p - record.f[i])),
    }
    return {
        migrants,
        migrantsTotal: totalsOf(migrants),
        natives,
        nativesTotal: totalsOf(natives),
    }
}

/**
 * An entity needs both a migrant stock and a total resident population in
 * every year the metadata lists. Upstream excludes territories that lack
 * UN/WPP population estimates, so a throw here means the data regressed.
 */
export function parseEntityYears(
    raw: RawEntityYears,
    metadata: MigrantDemographicsMetadata
): RawEntityYears {
    const numAgeBands = metadata.ageBands.length
    for (const year of metadata.years) {
        const record = raw[String(year)]
        if (!record)
            throw new Error(
                `[migrant-demographics] Entity data is missing a record for ${year}`
            )
        for (const key of ["m", "f", "pm", "pf"] as const) {
            if (!isBandAligned(record[key], numAgeBands))
                throw new Error(
                    `[migrant-demographics] Entity data has ${key} values that do not line up with the ${numAgeBands} age bands in ${year}`
                )
        }
    }
    return raw
}

/** Validates untrusted JSON, so the values may be absent at runtime */
function isBandAligned(
    values: number[] | undefined,
    numAgeBands: number
): values is number[] {
    return (
        Array.isArray(values) &&
        values.length === numAgeBands &&
        values.every((v) => Number.isFinite(v))
    )
}

function totalsOf(values: SexValues): PopulationTotals {
    const men = R.sum(values.men)
    const women = R.sum(values.women)
    return { men, women, total: men + women }
}
