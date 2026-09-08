/**
 * The chart editor's pluggable dependencies.
 *
 * The editor itself only needs a chart config and a way to load the data that
 * config points at. Everything else it shows is optional and comes from a
 * provider the host passes in: which indicators can be picked, which details
 * on demand exist, which URLs to fetch data from. The admin wires these to its
 * API (the `admin*` functions below); the editor playground and, eventually,
 * package consumers wire them to whatever they have.
 */
import { DetailDictionary } from "@ourworldindata/utils"
import { Admin } from "./Admin.js"
import { Dataset, IndicatorCatalogData, Namespace } from "./EditorDatabase.js"
import { CATALOG_URL, DATA_API_URL } from "../settings/clientSettings.js"

/** Lets the variable selector offer indicators. Absent → no "Add indicator". */
export interface IndicatorCatalog {
    load(): Promise<IndicatorCatalogData>
}

/** Details on demand, for validating `[term](#dod:term)` syntax in text fields. */
export interface DetailsProvider {
    load(): Promise<DetailDictionary>
}

/** Where the editor fetches indicator data for the preview. */
export interface EditorEnvironment {
    dataApiUrl: string
    catalogUrl: string
}

export const defaultEditorEnvironment: EditorEnvironment = {
    dataApiUrl: DATA_API_URL,
    catalogUrl: CATALOG_URL,
}

export function adminIndicatorCatalog(admin: Admin): IndicatorCatalog {
    return {
        async load(): Promise<IndicatorCatalogData> {
            // Usage counts only rank search results, so a failure there must
            // not take the picker down with it.
            const usagesPromise = admin
                .getJSONInBackground<
                    { variableId: number; usageCount: number }[]
                >("/api/variables.usages.json")
                .catch(() => [])
            const [namespaces, variables, usages] = await Promise.all([
                admin.getJSON<{ namespaces: Namespace[] }>(
                    "/api/editorData/namespaces.json"
                ),
                admin.getJSON<{ datasets: Dataset[] }>(
                    "/api/editorData/variables.json"
                ),
                usagesPromise,
            ])
            return {
                namespaces: namespaces.namespaces,
                datasets: variables.datasets,
                usageCounts: new Map(
                    usages.map(({ variableId, usageCount }) => [
                        variableId,
                        +usageCount,
                    ])
                ),
            }
        },
    }
}

export function adminDetailsProvider(admin: Admin): DetailsProvider {
    return {
        load(): Promise<DetailDictionary> {
            return admin.getJSON<DetailDictionary>("/api/parsed-dods.json")
        },
    }
}
