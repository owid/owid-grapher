import { QueryClient, useQuery } from "@tanstack/react-query"

import { fetchJson } from "@ourworldindata/utils"

import { toDisplayName } from "./entityNames.js"
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

interface MigrantEntity {
    name: string
    unName: string
    code: number
    isAggregate: boolean
    data: Record<string, RawYearRecord>
}

export class MigrantDemographics {
    readonly ageBands: string[]
    readonly years: number[]
    readonly source: string
    /** Stable array so consumers can use it as a memo dependency */
    readonly entityNames: string[]
    private readonly entitiesByName: Map<string, MigrantEntity>

    constructor(raw: RawMigrantDemographics) {
        this.ageBands = raw.ageBands
        this.years = raw.years
        this.source = raw.meta.source

        this.entitiesByName = new Map()
        for (const rawEntity of raw.entities) {
            if (!isValidEntity(rawEntity, raw.years, raw.ageBands.length)) {
                console.warn(
                    `[migrant-demographics] Skipping entity with malformed data: ${rawEntity.name}`
                )
                continue
            }
            const name = toDisplayName(rawEntity.name)
            if (this.entitiesByName.has(name)) {
                console.warn(
                    `[migrant-demographics] Skipping duplicate entity name: ${rawEntity.name} → ${name}`
                )
                continue
            }
            this.entitiesByName.set(name, {
                name,
                unName: rawEntity.name,
                code: rawEntity.code,
                isAggregate: rawEntity.isAggregate ?? false,
                data: rawEntity.data,
            })
        }

        this.entityNames = [...this.entitiesByName.keys()]
    }

    hasEntity(name: string): boolean {
        return this.entitiesByName.has(name)
    }

    getPyramidData(entityName: string, year: number): PyramidData | undefined {
        const record = this.entitiesByName.get(entityName)?.data[String(year)]
        if (!record) return undefined
        return computePyramidData(record)
    }
}

/**
 * Derive the migrant and native-born populations from a raw year record.
 * Native-born = total resident population minus migrant stock, clamped at
 * zero (a few small territories report more migrants than residents), and
 * absent entirely where the record carries no total-population data.
 */
export function computePyramidData(record: RawYearRecord): PyramidData {
    const migrants = { men: record.m, women: record.f }
    const migrantsTotal = totalsOf(migrants)

    const numAgeBands = record.m.length
    if (
        !isBandAligned(record.pm, numAgeBands) ||
        !isBandAligned(record.pf, numAgeBands)
    )
        return { migrants, migrantsTotal }

    const natives = {
        men: record.pm.map((p, i) => Math.max(0, p - record.m[i])),
        women: record.pf.map((p, i) => Math.max(0, p - record.f[i])),
    }
    return {
        migrants,
        migrantsTotal,
        natives,
        nativesTotal: totalsOf(natives),
    }
}

/**
 * Only the migrant stock is required — an entity without total-population
 * data still has a pyramid to draw, it just can't be compared with the
 * native-born population.
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
            isBandAligned(record.f, numAgeBands)
        )
    })
}

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
    const men = sum(values.men)
    const women = sum(values.women)
    return { men, women, total: men + women }
}

function sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0)
}
