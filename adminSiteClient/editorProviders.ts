import {
    IndicatorDimensionInterface,
    SlugDimensionInterface,
} from "@ourworldindata/types"
import { DetailDictionary } from "@ourworldindata/utils"
import { ChartDimension } from "@ourworldindata/grapher"
import type { SearchFieldHelp } from "../adminShared/variableSearch.js"
import type { DatasetListGroup, VariableListItem } from "./VariableList.js"

/** What a slot draws: an OWID indicator by id, or a host table's column by slug */
export type PickedColumn =
    | Pick<IndicatorDimensionInterface, "variableId" | "slug">
    | Pick<SlugDimensionInterface, "slug" | "variableId">

/** Identifies a column across a slot's dimensions and the picker's rows */
export function columnKey(column: PickedColumn): string {
    return column.variableId !== undefined
        ? `id:${column.variableId}`
        : `slug:${column.slug}`
}

export function columnOfDimension(dimension: ChartDimension): PickedColumn {
    return dimension.variableId !== undefined
        ? { variableId: dimension.variableId }
        : { slug: dimension.columnSlug }
}

/** An indicator the picker offers, with the column picking it puts in a slot */
export type CatalogIndicator = VariableListItem & { column: PickedColumn }

export type CatalogDataset = DatasetListGroup<CatalogIndicator>

export interface IndicatorSearchPage {
    datasets: CatalogDataset[]
    /** What `total` counts: indicators when the query names a dataset */
    unit: "datasets" | "indicators"
    total: number
    pageSize: number
    /** Set when MySQL couldn't run a term as a regular expression */
    regexError?: string
    /** Terms that had to fall back to a slow scan */
    unindexedTerms?: string[]
}

/** Indicators the variable picker offers, searched a page at a time */
export interface IndicatorCatalog {
    /** The `field:value` terms `search` understands, for its help */
    fields: readonly SearchFieldHelp[]
    /** The search the picker opens on, given the datasets a slot draws from */
    initialQuery(datasetIds: number[]): string
    search(query: string, page: number): Promise<IndicatorSearchPage>
}

/** Details on demand, for checking `[term](#dod:term)` links in text fields */
export interface DetailsProvider {
    load(): Promise<DetailDictionary>
}
