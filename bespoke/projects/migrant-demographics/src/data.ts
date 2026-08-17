import { QueryClient, useQuery } from "@tanstack/react-query"
import * as R from "remeda"

import { fetchJson } from "@ourworldindata/utils"

import {
    PopulationTotals,
    PyramidData,
    RawEntity,
    RawMigrantDemographics,
    RawYearRecord,
    SexValues,
} from "./types.js"

const DATA_URL =
    "https://owid-public.owid.io/bespoke/migrant-demographics/migrant-demographics.json"

export const queryClient = new QueryClient()

export const useMigrantDemographics = () =>
    useQuery({
        queryKey: ["migrant-demographics", "data"],
        queryFn: async (): Promise<MigrantDemographics> =>
            new MigrantDemographics(
                await fetchJson<RawMigrantDemographics>(DATA_URL)
            ),
        staleTime: Infinity, // The data file is immutable within a session
    })

export class MigrantDemographics {
    readonly ageBands: string[]
    readonly years: number[]
    readonly source: string
    /** Stable array so consumers can use it as a memo dependency */
    readonly entityNames: string[]
    /** Entity name → year → record. Entity names are already OWID names. */
    private readonly recordsByEntityName: Map<
        string,
        Record<string, RawYearRecord>
    >

    constructor(raw: RawMigrantDemographics) {
        this.ageBands = raw.ageBands
        this.years = raw.years
        this.source = raw.meta.source

        this.recordsByEntityName = new Map()
        for (const entity of raw.entities) {
            if (!isValidEntity(entity, raw.years, raw.ageBands.length)) {
                console.warn(
                    `[migrant-demographics] Skipping entity with malformed data: ${entity.name}`
                )
                continue
            }
            this.recordsByEntityName.set(entity.name, entity.data)
        }

        this.entityNames = [...this.recordsByEntityName.keys()]
    }

    hasEntity(name: string): boolean {
        return this.recordsByEntityName.has(name)
    }

    getPyramidData(entityName: string, year: number): PyramidData | undefined {
        const record = this.recordsByEntityName.get(entityName)?.[String(year)]
        if (!record) return undefined
        return computePyramidData(record)
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
 * every year. Upstream excludes territories that lack UN/WPP population
 * estimates, so this only fires if the file regresses.
 */
function isValidEntity(
    entity: RawEntity,
    years: number[],
    numAgeBands: number
): boolean {
    if (!entity.name || !entity.data) return false
    return years.every((year) => {
        const record = entity.data[String(year)]
        if (!record) return false
        return (
            isBandAligned(record.m, numAgeBands) &&
            isBandAligned(record.f, numAgeBands) &&
            isBandAligned(record.pm, numAgeBands) &&
            isBandAligned(record.pf, numAgeBands)
        )
    })
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
