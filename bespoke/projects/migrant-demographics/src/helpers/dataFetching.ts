import { QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson } from "@ourworldindata/utils"
import { EntityName, Time } from "@ourworldindata/types"

import {
    AgeBandRow,
    MigrantDataJson,
    MigrantEntityJson,
    PyramidData,
} from "./constants.js"

const DATA_URL =
    "https://owid-public.owid.io/bespoke/migrant-demographics/migrant-demographics.json"

/**
 * Thin wrapper around the raw JSON providing convenient lookups. The whole
 * dataset is a single (~800 KB) file, so we fetch it once and derive
 * everything from it in memory.
 */
export class MigrantDataset {
    readonly meta: MigrantDataJson["meta"]
    readonly ageBands: string[]
    readonly years: Time[]
    readonly entities: MigrantEntityJson[]

    private readonly entityByName: Map<EntityName, MigrantEntityJson>

    constructor(json: MigrantDataJson) {
        this.meta = json.meta
        this.ageBands = json.ageBands
        this.years = json.years
        this.entities = json.entities
        this.entityByName = new Map(
            json.entities.map((entity) => [entity.name, entity])
        )
    }

    get source(): string {
        return this.meta.source
    }

    hasEntity(entityName: EntityName): boolean {
        return this.entityByName.has(entityName)
    }

    /** Compute everything the pyramid needs for one entity/year selection. */
    getPyramidData(
        entityName: EntityName,
        year: Time
    ): PyramidData | undefined {
        const entity = this.entityByName.get(entityName)
        const yearData = entity?.data[String(year)]
        if (!entity || !yearData) return undefined

        const rows: AgeBandRow[] = this.ageBands.map((ageBand, i) => {
            const men = yearData.m[i] ?? 0
            const women = yearData.f[i] ?? 0
            // Native-born = total resident population − migrants.
            const nativeMen = Math.max(0, (yearData.pm[i] ?? 0) - men)
            const nativeWomen = Math.max(0, (yearData.pf[i] ?? 0) - women)
            return { ageBand, men, women, nativeMen, nativeWomen }
        })

        const sum = (pick: (row: AgeBandRow) => number): number =>
            rows.reduce((acc, row) => acc + pick(row), 0)

        const totalMen = sum((row) => row.men)
        const totalWomen = sum((row) => row.women)
        const totalNativeMen = sum((row) => row.nativeMen)
        const totalNativeWomen = sum((row) => row.nativeWomen)

        return {
            entityName: entity.name,
            year,
            ageBands: this.ageBands,
            rows,
            totalMigrants: totalMen + totalWomen,
            totalNativeBorn: totalNativeMen + totalNativeWomen,
            totalMen,
            totalWomen,
        }
    }
}

export function useMigrantDataset(): {
    dataset?: MigrantDataset
    status: QueryStatus
} {
    const result = useQuery({
        queryKey: ["migrant-demographics"],
        queryFn: () => fetchJson<MigrantDataJson>(DATA_URL),
        staleTime: Infinity,
    })

    const dataset = result.data ? new MigrantDataset(result.data) : undefined
    return { dataset, status: result.status }
}
