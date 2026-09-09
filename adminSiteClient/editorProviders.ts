/**
 * The chart editor's pluggable dependencies.
 *
 * The editor itself only needs a chart config and a way to load the data that
 * config points at. Everything else it shows is optional and comes from a
 * provider the host passes in: which indicators can be picked, which details
 * on demand exist, which URLs to fetch data from. The admin wires these to its
 * API (adminEditorProviders.ts); the playground and package consumers wire
 * them to whatever they have.
 */
import { DetailDictionary } from "@ourworldindata/utils"
import { IndicatorCatalogData } from "./EditorDatabase.js"

/** Lets the variable selector offer indicators. Absent → no "Add indicator". */
export interface IndicatorCatalog {
    load(): Promise<IndicatorCatalogData>
}

/** Details on demand, for validating `[term](#dod:term)` syntax in text fields. */
export interface DetailsProvider {
    load(): Promise<DetailDictionary>
}

/** Where the editor fetches indicator data, and which OWID pages it may link to. */
export interface EditorEnvironment {
    /** OWID's Data API, e.g. https://api.ourworldindata.org/v1/indicators */
    dataApiUrl: string
    /** OWID's catalog of extra data (regions, ...), e.g. https://catalog.ourworldindata.org */
    catalogUrl: string
    /** An OWID admin to link indicators and charts to. Absent → no such links. */
    adminBaseUrl?: string
    /** The site charts are published on. Absent → no "copy chart URL". */
    bakedGrapherUrl?: string
    /** An ETL Wizard for the chart-animation tool. Absent → no such button. */
    wizardUrl?: string
}

/** OWID's public endpoints. A host with its own deployment overrides these. */
export const defaultEditorEnvironment: EditorEnvironment = {
    dataApiUrl: "https://api.ourworldindata.org/v1/indicators",
    catalogUrl: "https://catalog.ourworldindata.org",
}
