import {
    AxisConfigInterface,
    DimensionProperty,
    OwidChartDimensionInterface,
    ScaleType,
} from "@ourworldindata/types"
import { DetailDictionary } from "@ourworldindata/utils"
import { CONTINENTS_INDICATOR_ID } from "@ourworldindata/grapher"
import { Admin } from "./Admin.js"
import { Dataset, IndicatorCatalogData, Namespace } from "./EditorDatabase.js"
import { CATALOG_URL, DATA_API_URL } from "../settings/clientSettings.mjs"
import {
    GDP_PER_CAPITA_CATALOG_PATH,
    POPULATION_CATALOG_PATH,
} from "./constants.js"

/** Where the preview loads its data from */
export interface EditorEnvironment {
    dataApiUrl: string
    catalogUrl: string
}

export const defaultEditorEnvironment: EditorEnvironment = {
    dataApiUrl: DATA_API_URL,
    catalogUrl: CATALOG_URL,
}

/** Indicators the variable picker offers */
export interface IndicatorCatalog {
    load(): Promise<IndicatorCatalogData>
}

/** Details on demand, for checking `[term](#dod:term)` links in text fields */
export interface DetailsProvider {
    load(): Promise<DetailDictionary>
}

/** Indicators that fill a scatter plot's empty slots */
export interface ScatterDefaults {
    dimensions: OwidChartDimensionInterface[]
    xAxis?: AxisConfigInterface
}

/** The admin's indicators, ranked by how many charts use each */
export function adminIndicatorCatalog(admin: Admin): IndicatorCatalog {
    return {
        async load(): Promise<IndicatorCatalogData> {
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

/** Details on demand from the admin API */
export function adminDetailsProvider(admin: Admin): DetailsProvider {
    return {
        load(): Promise<DetailDictionary> {
            return admin.getJSON<DetailDictionary>("/api/parsed-dods.json")
        },
    }
}

/**
 * GDP per capita on a log x axis, continents as color and population as size.
 * GDP and population are skipped when `variableIdsByCatalogPath` lacks them.
 */
export function adminScatterDefaults(
    variableIdsByCatalogPath: Record<string, number | null> = {}
): ScatterDefaults {
    const gdpPerCapitaId = variableIdsByCatalogPath[GDP_PER_CAPITA_CATALOG_PATH]
    const populationId = variableIdsByCatalogPath[POPULATION_CATALOG_PATH]
    const dimensions: OwidChartDimensionInterface[] = []
    if (gdpPerCapitaId)
        dimensions.push({
            property: DimensionProperty.x,
            variableId: gdpPerCapitaId,
        })
    dimensions.push({
        property: DimensionProperty.color,
        variableId: CONTINENTS_INDICATOR_ID,
    })
    if (populationId)
        dimensions.push({
            property: DimensionProperty.size,
            variableId: populationId,
        })
    return {
        dimensions,
        xAxis: { scaleType: ScaleType.log, canChangeScaleType: true },
    }
}
