import { EntityName, Time } from "@ourworldindata/types"

/** Colors for the two sexes, matching OWID's population charts. */
export const MALE_COLOR = "#4C6EE0"
export const FEMALE_COLOR = "#B13267"

/** The stepped outline drawn for the native-born comparison. */
export const NATIVE_BORN_COLOR = "#1d3d63"

export const GRID_LINE_COLOR = "#e7e7e7"
export const AXIS_LABEL_COLOR = "#858585"

export type MetricMode = "number" | "share"

/** Per-year data for one entity, one array entry per age band. */
export interface YearData {
    /** Migrant stock — men */
    m: number[]
    /** Migrant stock — women */
    f: number[]
    /** Total resident population — men */
    pm: number[]
    /** Total resident population — women */
    pf: number[]
}

export interface MigrantEntityJson {
    code: number
    name: EntityName
    isAggregate: boolean
    data: Record<string, YearData>
}

export interface MigrantMetaJson {
    title: string
    source: string
    unit: string
    note: string
}

export interface MigrantDataJson {
    meta: MigrantMetaJson
    ageBands: string[]
    years: number[]
    entities: MigrantEntityJson[]
}

export interface MigrantDemographicsConfig {
    entity?: string
    year?: number
    metric?: MetricMode
    compare?: boolean
    hideControls?: boolean
    urlSync?: boolean
}

/** A single row of the pyramid: one age band, both sexes. */
export interface AgeBandRow {
    ageBand: string
    /** Migrant men in this band */
    men: number
    /** Migrant women in this band */
    women: number
    /** Native-born men in this band */
    nativeMen: number
    /** Native-born women in this band */
    nativeWomen: number
}

/** Everything the pyramid needs to render for one entity/year selection. */
export interface PyramidData {
    entityName: EntityName
    year: Time
    ageBands: string[]
    rows: AgeBandRow[]
    /** Total migrant stock (both sexes) */
    totalMigrants: number
    /** Total native-born residents (both sexes) */
    totalNativeBorn: number
    /** Total migrant men / women (for the header percentages) */
    totalMen: number
    totalWomen: number
}
