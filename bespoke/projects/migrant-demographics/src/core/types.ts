export type VariantName = "pyramid"

export const SHOW_MODES = ["number", "share"] as const

export type ShowMode = (typeof SHOW_MODES)[number]

/** Raw shapes of the migrant-demographics data files */
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

export type RawEntityYears = Record<string, RawYearRecord>

export interface RawMetadataEntity {
    code: number
    name: string
}

export interface RawMigrantDemographicsMetadata {
    meta: {
        title: string
        source: string
        unit: string
        note?: string
    }
    ageBands: string[]
    years: number[]
    entities: RawMetadataEntity[]
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
