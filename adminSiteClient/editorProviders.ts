import {
    DimensionProperty,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { ColumnSlug, DetailDictionary } from "@ourworldindata/utils"
import { CONTINENTS_INDICATOR_ID } from "@ourworldindata/grapher"
import { Admin } from "./Admin.js"
import type { References } from "./adminChartApi.js"
import type { OriginUrlSuggestion } from "./ConfigEditor.js"
import {
    INDICATOR_SEARCH_FIELDS,
    SearchFieldHelp,
    VariableResultView,
    VariablesGroupedSearchResult,
    VariablesSearchResult,
} from "../adminShared/variableSearch.js"
import type { DatasetListGroup, VariableListItem } from "./VariableList.js"
import { namesOneDataset, parseCatalogPath } from "./variableSearchQuery.js"
import {
    BAKED_BASE_URL,
    CATALOG_URL,
    DATA_API_URL,
} from "../settings/clientSettings.mjs"
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

/** An indicator the picker offers. A host table's column is picked by `slug`. */
export type CatalogIndicator = VariableListItem & { slug?: ColumnSlug }

export type CatalogDataset = DatasetListGroup<CatalogIndicator>

/** One page of a catalog search */
export interface IndicatorSearchPage {
    datasets: CatalogDataset[]
    /** What `total` counts: datasets, or a single dataset's indicators */
    unit: "datasets" | "indicators"
    total: number
    pageSize: number
    /** Why the query couldn't run as typed */
    error?: string
}

/** Indicators the variable picker offers, searched a page at a time */
export interface IndicatorCatalog {
    /** The `field:value` terms `search` understands, for its help */
    fields: readonly SearchFieldHelp[]
    /** The search the picker opens on, given the datasets a slot draws from */
    initialQuery(datasetIds: number[]): string
    search(query: string, page: number): Promise<IndicatorSearchPage>
}

/** Details on demand, for checking `[term](#dod:term)` links in text fields */
export interface DetailsProvider {
    load(): Promise<DetailDictionary>
}

const DATASETS_PER_PAGE = 8
const INDICATORS_PER_PAGE = 20

/** The admin's indicators, through the same search as /admin/variables */
export function adminIndicatorCatalog(admin: Admin): IndicatorCatalog {
    return {
        fields: INDICATOR_SEARCH_FIELDS,
        initialQuery: (datasetIds) => {
            // A slot's next indicator most often comes from the dataset its
            // others are from; one spanning several gets no guess
            const distinct = new Set(datasetIds)
            return distinct.size === 1 ? `dataset-id:${[...distinct][0]}` : ""
        },
        async search(query, page) {
            if (namesOneDataset(query)) {
                const result =
                    await admin.getJSONInBackground<VariablesSearchResult>(
                        "/api/variables.json",
                        {
                            search: query,
                            limit: INDICATORS_PER_PAGE,
                            offset: (page - 1) * INDICATORS_PER_PAGE,
                        }
                    )
                return {
                    datasets: groupByDataset(result.variables),
                    unit: "indicators",
                    total: result.numTotalRows,
                    pageSize: INDICATORS_PER_PAGE,
                    error: result.regexError,
                }
            }
            const result =
                await admin.getJSONInBackground<VariablesGroupedSearchResult>(
                    "/api/variables.json",
                    {
                        search: query,
                        group: "dataset",
                        limit: DATASETS_PER_PAGE,
                        offset: (page - 1) * DATASETS_PER_PAGE,
                    }
                )
            return {
                datasets: result.datasets,
                unit: "datasets",
                total: result.numTotalDatasets,
                pageSize: DATASETS_PER_PAGE,
                error: result.regexError,
            }
        },
    }
}

/** A page of one dataset's indicators, under that dataset's header */
function groupByDataset(variables: VariableResultView[]): CatalogDataset[] {
    const groups = new Map<number, CatalogDataset>()
    for (const variable of variables) {
        const group = groups.get(variable.datasetId)
        if (group) {
            group.variables.push(variable)
            continue
        }
        const path = variable.catalogPath
            ? parseCatalogPath(variable.catalogPath)
            : undefined
        groups.set(variable.datasetId, {
            id: variable.datasetId,
            name: variable.datasetName,
            namespace: path?.namespace,
            version: path?.version,
            shortName: path?.dataset,
            uploadedAt: variable.uploadedAt,
            uploadedBy: variable.uploadedBy,
            variables: [variable],
        })
    }
    return [...groups.values()]
}

/** Details on demand from the admin API */
export function adminDetailsProvider(admin: Admin): DetailsProvider {
    return {
        load(): Promise<DetailDictionary> {
            return admin.getJSON<DetailDictionary>("/api/parsed-dods.json")
        },
    }
}

/** Indicators the admin fills a new scatter plot's empty slots with */
export function adminScatterDefaults(
    variableIdsByCatalogPath: Record<string, number | null> = {}
): OwidChartDimensionInterface[] {
    const gdpPerCapitaId = variableIdsByCatalogPath[GDP_PER_CAPITA_CATALOG_PATH]
    const populationId = variableIdsByCatalogPath[POPULATION_CATALOG_PATH]
    const variableIdsByProperty = [
        [DimensionProperty.x, gdpPerCapitaId],
        [DimensionProperty.color, CONTINENTS_INDICATOR_ID],
        [DimensionProperty.size, populationId],
    ] as const
    return variableIdsByProperty.flatMap(([property, variableId]) =>
        variableId ? [{ property, variableId }] : []
    )
}

/** The Origin url dropdown's entries: posts that show the chart, then every published topic page */
export function adminOriginUrlSuggestions(
    references: References | undefined,
    topicSlugs: string[]
): OriginUrlSuggestion[] {
    const posts = [
        ...(references?.postsWordpress ?? []),
        ...(references?.postsGdocs ?? []),
    ].map((post) => ({
        url: post.url.replace(BAKED_BASE_URL, ""),
        hint: "(referenced by this chart)",
    }))

    return [
        ...posts,
        ...topicSlugs
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((slug) => ({ url: `/${slug}` })),
    ]
}
