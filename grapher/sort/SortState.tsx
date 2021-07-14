import { SortOrder } from "../../clientUtils/owidTypes"

export enum SortBy {
    entityName = "entityName",
    dimension = "dimension",
    total = "total",
}

interface SortByTotalConfig {
    sortBy: SortBy.total
    sortOrder: SortOrder
}

interface SortByEntityNameConfig {
    sortBy: SortBy.entityName
    sortOrder: SortOrder
}

export interface SortByDimensionConfig {
    sortBy: SortBy.dimension
    sortOrder: SortOrder
    sortColumnSlug: string // TODO should we use a variable name instead, might be better?
}

export type SortConfig =
    | SortByTotalConfig
    | SortByEntityNameConfig
    | SortByDimensionConfig
