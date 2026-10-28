import { DetailDictionary } from "@ourworldindata/utils"
import { IndicatorCatalogData } from "./EditorDatabase.js"

/** Indicators the variable picker offers */
export interface IndicatorCatalog {
    load(): Promise<IndicatorCatalogData>
}

/** Details on demand, for checking `[term](#dod:term)` links in text fields */
export interface DetailsProvider {
    load(): Promise<DetailDictionary>
}
