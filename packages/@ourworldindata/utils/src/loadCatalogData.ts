import * as _ from "lodash-es"
import {
    CatalogDataPoint,
    CatalogKey,
    ColumnTypeNames,
    OwidColumnDef,
} from "@ourworldindata/types"
import { fetchJson } from "./Util.js"

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
    { baseUrl }: { baseUrl: string }
): Promise<CatalogDataPoint[]> {
    const url = `${baseUrl}/external/owid_grapher/latest/${catalogPaths[key]}`
    return fetchJson<CatalogDataPoint[]>(url)
}

export const loadCatalogVariableData: (
    key: CatalogKey,
    { baseUrl }: { baseUrl: string }
) => Promise<CatalogDataPoint[]> = _.memoize(_loadCatalogVariableData)
