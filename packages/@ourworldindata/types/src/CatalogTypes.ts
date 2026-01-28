export type CatalogKey = "gdp" | "population"

export interface CatalogDataPoint {
    entity: string
    year: number
    value: number
}
