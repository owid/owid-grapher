import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"
import * as R from "remeda"

import { fetchJson } from "@ourworldindata/utils"

import {
    PopulationTotals,
    PyramidData,
    RawEntityYears,
    RawMigrantDemographics,
    RawMigrantDemographicsManifest,
    RawYearRecord,
    SexValues,
} from "./types.js"

const BASE_URL = "https://owid-public.owid.io/bespoke/migrant-demographics"
const MANIFEST_PATH = `${BASE_URL}/migrant-demographics.metadata.json`
const WHOLE_FILE_PATH = `${BASE_URL}/migrant-demographics.json`

export const queryClient = new QueryClient()

export interface MigrantDemographicsData {
    manifest: MigrantDemographicsManifest
    entityYearsByName: Map<string, RawEntityYears>
}

export const useMigrantDemographics = () =>
    useQuery({
        queryKey: ["migrant-demographics", "data"],
        queryFn: async (): Promise<MigrantDemographicsData> => {
            const raw = await fetchJson<RawMigrantDemographics>(WHOLE_FILE_PATH)
            const manifest = new MigrantDemographicsManifest(raw)
            const entityYearsByName = new Map(
                raw.entities.map((entity) => [
                    entity.name,
                    parseEntityYears(entity.data, manifest),
                ])
            )
            return { manifest, entityYearsByName }
        },
        staleTime: Infinity,
    })

export const useMigrantDemographicsManifest = (): {
    data?: MigrantDemographicsManifest
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: ["migrant-demographics", "manifest"],
        queryFn: async (): Promise<MigrantDemographicsManifest> => {
            const raw =
                await fetchJson<RawMigrantDemographicsManifest>(MANIFEST_PATH)
            return new MigrantDemographicsManifest(raw)
        },
        staleTime: Infinity, // The data files are immutable within a session
    })

    return { data: result.data, status: result.status }
}

export class MigrantDemographicsManifest {
    readonly ageBands: string[]
    readonly years: number[]
    readonly source: string
    /** Stable array so consumers can use it as a memo dependency */
    readonly entityNames: string[]
    private readonly codesByEntityName: Map<string, number>

    constructor(raw: RawMigrantDemographicsManifest) {
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
 * every year the manifest lists. Upstream excludes territories that lack
 * UN/WPP population estimates, so a throw here means the data regressed.
 */
export function parseEntityYears(
    raw: RawEntityYears,
    manifest: MigrantDemographicsManifest
): RawEntityYears {
    const numAgeBands = manifest.ageBands.length
    for (const year of manifest.years) {
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
