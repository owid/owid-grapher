import {
    DimensionProperty,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { DetailDictionary, Json } from "@ourworldindata/utils"
import { CONTINENTS_INDICATOR_ID } from "@ourworldindata/grapher"
import { Admin } from "./Admin.js"
import type { References } from "./adminChartApi.js"
import type { OriginUrlSuggestion } from "./ConfigEditor.js"
import {
    DatasetSearchGroup,
    INDICATOR_SEARCH_FIELDS,
    VariableResultView,
    VariablesGroupedSearchResult,
    VariablesSearchResult,
} from "../adminShared/variableSearch.js"
import {
    CATALOG_DATASETS_PER_PAGE,
    CatalogDataset,
    CatalogIndicator,
    DetailsProvider,
    IndicatorCatalog,
} from "./editorProviders.js"
import { namesOneDataset, parseCatalogPath } from "./variableSearchQuery.js"
import { dataApiIndicatorStore, IndicatorStore } from "./indicatorStores.js"
import { BAKED_BASE_URL, DATA_API_URL } from "../settings/clientSettings.mjs"
import {
    GDP_PER_CAPITA_CATALOG_PATH,
    POPULATION_CATALOG_PATH,
} from "./constants.js"

export function adminIndicatorUrl(
    dimension: OwidChartDimensionInterface
): string | undefined {
    return dimension.variableId !== undefined
        ? `/admin/variables/${dimension.variableId}`
        : undefined
}

const INDICATORS_PER_PAGE = 20

// The admin's rows carry more than a host's, which the admin's list shows
type AdminCatalogIndicator = CatalogIndicator & VariableResultView
type AdminCatalogDataset = CatalogDataset &
    Partial<Pick<DatasetSearchGroup, "shortName" | "uploadedAt" | "uploadedBy">>

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
            // The picker says when a search fails; the admin's own error
            // dialog would reload the page and lose the chart's edits
            const get = <T extends Json>(params: Json): Promise<T> =>
                admin.requestJSON<T>("/api/variables.json", params, "GET", {
                    onFailure: "continue",
                    isBackground: true,
                })
            if (namesOneDataset(query)) {
                const result = await get<VariablesSearchResult>({
                    search: query,
                    limit: INDICATORS_PER_PAGE,
                    offset: (page - 1) * INDICATORS_PER_PAGE,
                })
                return {
                    datasets: groupByDataset(result.variables),
                    unit: "indicators",
                    total: result.numTotalRows,
                    pageSize: INDICATORS_PER_PAGE,
                    regexError: result.regexError,
                    unindexedTerms: result.unindexedTerms,
                }
            }
            const result = await get<VariablesGroupedSearchResult>({
                search: query,
                group: "dataset",
                limit: CATALOG_DATASETS_PER_PAGE,
                offset: (page - 1) * CATALOG_DATASETS_PER_PAGE,
            })
            return {
                datasets: result.datasets.map((dataset) => ({
                    ...dataset,
                    version: dataset.version ?? undefined,
                    variables: dataset.variables.map(asCatalogIndicator),
                })),
                unit: "datasets",
                total: result.numTotalDatasets,
                pageSize: CATALOG_DATASETS_PER_PAGE,
                regexError: result.regexError,
                unindexedTerms: result.unindexedTerms,
            }
        },
    }
}

function headerOf(variable: VariableResultView): AdminCatalogDataset {
    const path = variable.catalogPath
        ? parseCatalogPath(variable.catalogPath)
        : undefined
    return {
        id: variable.datasetId,
        name: variable.datasetName,
        namespace: path?.namespace,
        version: path?.version,
        shortName: path?.dataset,
        uploadedAt: variable.uploadedAt,
        uploadedBy: variable.uploadedBy,
        variables: [],
    }
}

function asCatalogIndicator(
    variable: VariableResultView
): AdminCatalogIndicator {
    return { ...variable, column: { variableId: variable.id } }
}

/** A page of indicators, under the headers of the datasets they are from */
function groupByDataset(
    variables: VariableResultView[]
): AdminCatalogDataset[] {
    const groups = new Map<number, AdminCatalogDataset>()
    for (const variable of variables) {
        const group = groups.get(variable.datasetId) ?? headerOf(variable)
        group.variables.push(asCatalogIndicator(variable))
        groups.set(variable.datasetId, group)
    }
    return [...groups.values()]
}

export function adminIndicatorStore(admin: Admin): IndicatorStore {
    return dataApiIndicatorStore({
        dataApiUrl: DATA_API_URL,
        catalog: adminIndicatorCatalog(admin),
    })
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
