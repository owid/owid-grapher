import type { NumericCatalogKey } from "@ourworldindata/types"
import { columnDefsByCatalogKey } from "../core/loadCatalogData.js"

/** Catalog indicators that can be loaded on demand for sorting in EntitySelector */
export const EXTERNAL_SORT_INDICATOR_DEFINITIONS = [
    {
        catalogKey: "population" satisfies NumericCatalogKey,
        slug: columnDefsByCatalogKey["population"].slug,
        label: "Population",
    },
    {
        catalogKey: "gdp" satisfies NumericCatalogKey,
        slug: columnDefsByCatalogKey["gdp"].slug,
        label: "GDP per capita (int. $)",
    },
] as const

export type ExternalSortIndicatorDefinition =
    (typeof EXTERNAL_SORT_INDICATOR_DEFINITIONS)[number]
