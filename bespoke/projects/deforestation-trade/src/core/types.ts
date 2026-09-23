import type { BespokeMetadata } from "@ourworldindata/types"

export type VariantName = "sankey"

export const VIEWS = ["production", "consumption"] as const
/** Which side of a selected country is shown: where what it produced was
 *  consumed, or where what it consumed was produced */
export type View = (typeof VIEWS)[number]

export const PERIODS = ["single-year", "last-5-years", "last-10-years"] as const
/** How much time the chart sums over: the year on the slider, or the last
 *  N years of the data, ending at its most recent year */
export type Period = (typeof PERIODS)[number]

/** The inclusive span of years the chart shows; `start === end` for a single year */
export type YearRange = { start: number; end: number }

export type Entity = { id: number; name: string; iso: string; region: string }
export type CommodityGroup = { id: number; name: string }

// ---------------------------------------------------------------------------
// Wire format (what scripts/buildData.py writes and the bundle fetches)
// ---------------------------------------------------------------------------

/**
 * One block of flows as parallel arrays. `partners[i]` and `groups[i]` are
 * entity / commodity-group ids; `values[i]` is aligned to `years` in the
 * metadata, in hectares of amortized deforestation risk, `null` = no data.
 *
 * In an `imports` block the partners are the *producing* countries, in an
 * `exports` block the *consuming* countries.
 */
export type RawFlowBlock = {
    partners: number[]
    groups: number[]
    values: (number | null)[][]
}

/** `deforestation-trade.<entityId>.json`. Domestic flows (partner == the
 *  country itself) appear in both blocks. */
export type RawCountryJson = { imports: RawFlowBlock; exports: RawFlowBlock }

/** `deforestation-trade.metadata.json`: the manifest plus the fields of
 *  `BespokeMetadataSchema` for the methods-and-sources box. */
export type RawMetadataJson = BespokeMetadata & {
    timeRange: { start: number; end: number }
    years: number[]
    source: string
    dimensions: {
        entities: Entity[]
        commodityGroups: CommodityGroup[]
    }
}

// ---------------------------------------------------------------------------
// Decoded, name-resolved shapes used by the components
// ---------------------------------------------------------------------------

export type DeforestationMetadata = {
    years: number[]
    source: string
    entities: Entity[]
    commodityGroups: CommodityGroup[]
    entityById: Map<number, Entity>
    entityByName: Map<string, Entity>
    /** The validated `BespokeMetadataSchema` part, if it parsed */
    bespoke: BespokeMetadata | undefined
}

/** One partner × commodity-group flow across all years */
export type TradeSeries = {
    partner: string
    group: string
    /** Aligned to `DeforestationMetadata.years` */
    values: (number | null)[]
}

/** One partner × commodity-group flow for a single year */
export type TradeRow = {
    partner: string
    group: string
    value: number
}

export type CountryData = {
    country: string
    imports: TradeSeries[]
    exports: TradeSeries[]
}
