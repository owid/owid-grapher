import * as _ from "lodash-es"
import {
    CatalogDataPoint,
    CatalogKey,
    ColumnTypeNames,
    OwidColumnDef,
} from "@ourworldindata/types"
import { fetchJson } from "./Util.js"

/**
 * Column definitions with display metadata for catalog indicators.
 * Maps each catalog key to its column definition.
 */
export const columnDefsByCatalogKey: Record<CatalogKey, OwidColumnDef> = {
    population: {
        slug: "population",
        name: "Population",
        type: ColumnTypeNames.Integer,
    },
    gdp: {
        slug: "gdp",
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
    const url = `${baseUrl}/external/owid_grapher/latest/${key}/${key}.json`
    return fetchJson<CatalogDataPoint[]>(url)
}

export const loadCatalogVariableData: (
    key: CatalogKey,
    { baseUrl }: { baseUrl: string }
) => Promise<CatalogDataPoint[]> = _.memoize(_loadCatalogVariableData)
