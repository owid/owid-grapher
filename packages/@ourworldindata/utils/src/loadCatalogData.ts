import * as _ from "lodash-es"
import {
    AssetMap,
    CatalogDataPoint,
    CatalogKey,
    ColumnTypeNames,
    OwidColumnDef,
} from "@ourworldindata/types"
import { fetchJson, readFromAssetMap } from "./Util.js"

/**
 * Gets the asset map key for a catalog path.
 * E.g., "population" -> "catalog/population.json"
 */
export function getCatalogAssetKey(key: CatalogKey): string {
    return `catalog/${key}.json`
}

/** Paths to catalog data files */
const catalogPaths: Record<CatalogKey, `${string}.json`> = {
    population: "population/population.json",
    gdp: "gdp/gdp.json",
}

/** Column definitions with display metadata for catalog data */
export const columnDefsByCatalogKey: Record<CatalogKey, OwidColumnDef> = {
    population: {
        slug: "catalog-population",
        name: "Population",
        type: ColumnTypeNames.Integer,
    },
    gdp: {
        slug: "catalog-gdp",
        name: "GDP per capita",
        type: ColumnTypeNames.Integer,
        shortUnit: "$",
    },
}

/** Loads indicator data from the OWID catalog */
async function _loadCatalogVariableData(
    key: CatalogKey,
    { baseUrl, assetMap }: { baseUrl: string; assetMap?: AssetMap }
): Promise<CatalogDataPoint[]> {
    const assetKey = getCatalogAssetKey(key)
    const catalogPath = `${baseUrl}/external/owid_grapher/latest/${catalogPaths[key]}`
    const url = readFromAssetMap(assetMap, {
        path: assetKey,
        fallback: catalogPath,
    })
    return fetchJson<CatalogDataPoint[]>(url)
}

export const loadCatalogVariableData: (
    key: CatalogKey,
    { baseUrl, assetMap }: { baseUrl: string; assetMap?: AssetMap }
) => Promise<CatalogDataPoint[]> = _.memoize(_loadCatalogVariableData)
