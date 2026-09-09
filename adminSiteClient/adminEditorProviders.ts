/**
 * The admin's implementations of the chart editor's providers: its indicator
 * catalog and details-on-demand come from the admin API, its URLs from the
 * admin's settings. The editor itself only knows the interfaces in
 * editorProviders.ts; this is what the admin pages plug in.
 */
import { DetailDictionary } from "@ourworldindata/utils"
import { Admin } from "./Admin.js"
import { Dataset, IndicatorCatalogData, Namespace } from "./EditorDatabase.js"
import {
    DetailsProvider,
    EditorEnvironment,
    IndicatorCatalog,
} from "./editorProviders.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    CATALOG_URL,
    DATA_API_URL,
    ETL_WIZARD_URL,
} from "../settings/clientSettings.js"

/** The admin's URLs: dev and staging point at their own Data API and site. */
export const adminEditorEnvironment: EditorEnvironment = {
    dataApiUrl: DATA_API_URL,
    catalogUrl: CATALOG_URL,
    adminBaseUrl: ADMIN_BASE_URL,
    bakedGrapherUrl: BAKED_GRAPHER_URL,
    wizardUrl: ETL_WIZARD_URL,
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

/** Published topic pages, offered as suggestions for a chart's origin URL. */
export function adminTopicSlugs(admin: Admin): () => Promise<string[]> {
    return async () => {
        const json = await admin.getJSON<{ slugs: string[] }>(
            "/api/gdocs/publishedTopicSlugs"
        )
        return json.slugs
    }
}
