import { DetailDictionary } from "@ourworldindata/utils"
import { IndicatorCatalogData } from "./EditorDatabase.js"

/** The URLs the editor talks to */
export interface EditorEnvironment {
    /** Where the preview loads indicator data from */
    dataApiUrl: string
    /** Where the preview loads catalog data (e.g. the region list) from */
    catalogUrl: string
    /** ETL wizard to offer the chart animation tool from; hidden without one */
    etlWizardUrl?: string
}

/** OWID's public servers */
export const defaultEditorEnvironment: EditorEnvironment = {
    dataApiUrl: "https://api.ourworldindata.org/v1/indicators",
    catalogUrl: "https://catalog.ourworldindata.org",
}

/** Indicators the variable picker offers */
export interface IndicatorCatalog {
    load(): Promise<IndicatorCatalogData>
}

/** Details on demand, for checking `[term](#dod:term)` links in text fields */
export interface DetailsProvider {
    load(): Promise<DetailDictionary>
}
