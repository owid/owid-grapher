export type VariantName = "pyramid"

export type ShowMode = "number" | "share"

export interface VariantProps<Config> {
    config: Config
}

/** Raw shapes of migrant-demographics.json */
export interface RawYearRecord {
    /** Migrant stock by age band: men / women */
    m: number[]
    f: number[]
    /**
     * Total resident population by age band: men / women. These are WPP
     * interpolations, so don't read person-level precision into them.
     */
    pm: number[]
    pf: number[]
}

export interface RawEntity {
    name: string
    data: Record<string, RawYearRecord>
}

export interface RawMigrantDemographics {
    meta: {
        title: string
        source: string
        unit: string
        note?: string
    }
    ageBands: string[]
    years: number[]
    entities: RawEntity[]
}

/** Values per age band (aligned with `ageBands`, youngest first) */
export interface SexValues {
    men: number[]
    women: number[]
}

export interface PopulationTotals {
    men: number
    women: number
    total: number
}

/** Migrant and native-born populations of one entity in one year */
export interface PyramidData {
    migrants: SexValues
    migrantsTotal: PopulationTotals
    natives: SexValues
    nativesTotal: PopulationTotals
}
