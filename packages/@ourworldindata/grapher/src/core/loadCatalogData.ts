import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import {
    AdditionalGrapherDataFetchFn,
    AssetMap,
    CatalogDataForKey,
    CatalogKey,
    CatalogNumericDataPoint,
    ColumnSlug,
    ColumnTypeNames,
    NumericCatalogKey,
    OwidColumnDef,
} from "@ourworldindata/types"
import { fetchJson, readFromAssetMap } from "@ourworldindata/utils"

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
    neighbors: "neighbours/neighbours.json",
}

/** Column definitions with display metadata for numeric catalog data */
export const columnDefsByCatalogKey: Record<NumericCatalogKey, OwidColumnDef> =
    {
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
async function _loadCatalogData<K extends CatalogKey>(
    key: K,
    { baseUrl, assetMap }: { baseUrl: string; assetMap?: AssetMap }
): Promise<CatalogDataForKey<K>> {
    const assetKey = getCatalogAssetKey(key)
    const catalogPath = `${baseUrl}/external/owid_grapher/latest/${catalogPaths[key]}`
    const url = readFromAssetMap(assetMap, {
        path: assetKey,
        fallback: catalogPath,
    })
    return fetchJson(url)
}

export const loadCatalogData = _.memoize(_loadCatalogData)

/** Creates an OwidTable from numeric catalog data points */
function catalogDataToOwidTable(
    data: CatalogNumericDataPoint[],
    columnDef: OwidColumnDef
): OwidTable {
    const rows = data.map((point) => ({
        entityName: point.entity,
        year: point.year,
        [columnDef.slug]: point.value,
    }))

    return new OwidTable(rows, [columnDef])
}

/** Loads numeric catalog data and transforms it into an OwidTable */
export async function loadCatalogDataAsOwidTable(
    key: NumericCatalogKey,
    loadCatalogDataFn: AdditionalGrapherDataFetchFn
): Promise<{ table: OwidTable; slug: ColumnSlug }> {
    const data = await loadCatalogDataFn(key)
    const columnDef = columnDefsByCatalogKey[key]
    const table = catalogDataToOwidTable(data, columnDef)
    return { table, slug: columnDef.slug }
}
