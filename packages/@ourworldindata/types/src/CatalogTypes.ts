/** Supported catalog keys */
export type CatalogKey = "gdp" | "population" | "neighbors"

/** Catalog keys that have numeric data */
export type NumericCatalogKey = "gdp" | "population"

/** Catalog keys that have list data */
type ListCatalogKey = "neighbors"

/** Catalog data point with numeric value and year */
export interface CatalogNumericDataPoint {
    entity: string
    year: number
    value: number
}

/** Catalog data point with a list value */
export interface CatalogListDataPoint {
    entity: string
    value: string[]
}

/** Maps a CatalogKey to its corresponding data point type */
export type CatalogDataForKey<K extends CatalogKey> = K extends ListCatalogKey
    ? CatalogListDataPoint[]
    : CatalogNumericDataPoint[]
