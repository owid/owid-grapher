import { EntityName, Time } from "@ourworldindata/types"

type NumericId = number

export interface BasicEntry {
    id: NumericId
    name: string
}

export type RegionMetadata = BasicEntry
export type EntityMetadata = BasicEntry & { region: NumericId }
export type ConflictTypeMetadata = BasicEntry & { slug: string }

/** Shape of `conflict-deaths.metadata.json` (the chart-specific fields) */
export interface MetadataJson {
    source: string
    timeRange: { start: number; end: number }
    regions: RegionMetadata[]
    entities: EntityMetadata[]
    conflictTypes: ConflictTypeMetadata[]
}

/**
 * Shape of `conflict-deaths.<conflictTypeId>.json`: parallel arrays holding
 * the non-zero deaths. A country-year that is missing had no recorded deaths.
 */
export interface DataJson {
    values: number[]
    entities: number[]
    years: number[]
}

/** Region colors, as used in our other UCDP charts by region */
const REGION_COLORS: Record<string, string> = {
    Africa: "#a2559c",
    Americas: "#e56e5a",
    "Asia and Oceania": "#00847e",
    Europe: "#4c6a9c",
    "Middle East": "#bc8e5a",
}

export const getRegionColor = (region?: string): string => {
    if (!region) return "#cccccc"
    return REGION_COLORS[region] || "#cccccc"
}

export const DEFAULT_CONFLICT_TYPE = "all"

/** How each conflict type reads in a sentence ("…die in ___ in 2025?") */
const CONFLICT_TYPE_PHRASES: Record<string, string> = {
    all: "armed conflicts",
    interstate: "interstate conflicts",
    intrastate: "intrastate conflicts",
    "non-state": "non-state conflicts",
    "one-sided": "one-sided violence",
}

export const getConflictTypePhrase = (
    conflictType: ConflictTypeMetadata
): string =>
    CONFLICT_TYPE_PHRASES[conflictType.slug] ?? conflictType.name.toLowerCase()

export interface DataRow {
    entityName: EntityName
    year: Time
    region: string
    value: number
}

export interface EnrichedDataItem {
    /** Unique id: the entity name for countries, the region name for regions */
    id: string
    entityName?: EntityName
    year: Time
    region?: string
    parentId?: string
    value?: number
    share?: number
}

export type TreeNode = d3.HierarchyRectangularNode<
    d3.HierarchyNode<EnrichedDataItem>
>

export interface TooltipState {
    target: { node: TreeNode } | null
    position: { x: number; y: number }
}
