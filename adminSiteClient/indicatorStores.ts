import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnSlug,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidTableSlugs,
    SelectedEntityColors,
} from "@ourworldindata/types"
import {
    appendSelectedEntityColors,
    applyDimensionDisplayAndConversionFactor,
    getCachingInputTableFetcher,
} from "@ourworldindata/grapher"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
} from "../adminShared/search.js"
import {
    CatalogDataset,
    CatalogIndicator,
    IndicatorCatalog,
} from "./editorProviders.js"

export interface IndicatorStore {
    catalog?: IndicatorCatalog
    loadTable(
        dimensions: OwidChartDimensionInterface[],
        selectedEntityColors: SelectedEntityColors | undefined
    ): Promise<OwidTable | undefined>
}

/** OWID's indicator store: variableIds resolved against the Data API */
export function dataApiIndicatorStore(options: {
    dataApiUrl: string
    catalog?: IndicatorCatalog
}): IndicatorStore {
    const fetchTable = getCachingInputTableFetcher(
        options.dataApiUrl,
        undefined,
        true
    )
    return {
        catalog: options.catalog,
        loadTable: (dimensions, selectedEntityColors) =>
            fetchTable(dimensions, selectedEntityColors),
    }
}

/** A dataset of OWID indicators, as `listIndicatorCatalog` takes them */
export interface IndicatorListDataset {
    id: number
    name: string
    namespace?: string
    version?: string
    variables: { id: number; name: string }[]
}

/**
 * A catalog over a list of datasets the host loads once, searched in the
 * browser by indicator name. `load` has the shape of a 0.1.0 catalog's, so
 * `listIndicatorCatalog(catalog.load)` upgrades one.
 */
export function listIndicatorCatalog(
    load: () => Promise<{ datasets: IndicatorListDataset[] }>
): IndicatorCatalog {
    return inMemoryCatalog(async () =>
        (await load()).datasets.map((dataset) => ({
            id: dataset.id,
            name: dataset.name,
            namespace: dataset.namespace,
            version: dataset.version,
            variables: dataset.variables.map((variable) => ({
                id: variable.id,
                name: variable.name,
                column: { variableId: variable.id },
            })),
        }))
    )
}

const DATASETS_PER_PAGE = 8

function inMemoryCatalog(
    load: () => Promise<CatalogDataset[]>
): IndicatorCatalog {
    let datasets: Promise<CatalogDataset[]> | undefined
    return {
        fields: [],
        initialQuery: () => "",
        async search(query, page) {
            // A failed load is retried by the next search
            datasets ??= load().catch((error: unknown) => {
                datasets = undefined
                throw error
            })
            const matches = filterFunctionForSearchWords(
                buildSearchWordsFromSearchString(query),
                (indicator: CatalogIndicator) => [
                    indicator.name,
                    indicator.column.slug,
                ]
            )
            const groups = (await datasets).flatMap((dataset) => {
                const variables = dataset.variables.filter(matches)
                return variables.length
                    ? [{ ...dataset, matchCount: variables.length, variables }]
                    : []
            })
            return {
                datasets: groups.slice(
                    (page - 1) * DATASETS_PER_PAGE,
                    page * DATASETS_PER_PAGE
                ),
                unit: "datasets",
                total: groups.length,
                pageSize: DATASETS_PER_PAGE,
            }
        },
    }
}

/** Store for a host-supplied table. Dimensions name its columns by `slug`. */
export function tableIndicatorStore(
    table: OwidTable,
    options: { name?: string } = {}
): IndicatorStore {
    const datasetName = options.name ?? "Table"

    const nonDataSlugs = new Set<string>(Object.values(OwidTableSlugs))
    const dataSlugs = table.columnSlugs.filter(
        (slug) => !nonDataSlugs.has(slug)
    )

    const indicators: CatalogIndicator[] = dataSlugs.map((slug, i) => ({
        // only keys the row: picking it puts the column's slug in the slot
        id: i + 1,
        name: table.get(slug).displayName,
        column: { slug },
    }))
    const catalog = inMemoryCatalog(() =>
        Promise.resolve([{ id: 1, name: datasetName, variables: indicators }])
    )

    const isDataColumn = (slug: ColumnSlug | undefined): boolean =>
        slug !== undefined && dataSlugs.includes(slug)

    return {
        catalog,

        loadTable: (dimensions, selectedEntityColors) => {
            for (const dimension of dimensions)
                if (!isDataColumn(dimension.slug))
                    console.warn(
                        `${datasetName}: config references column "${dimension.slug ?? dimension.variableId}", which the table doesn't have`
                    )
            const dimensionSlugs = new Set(
                dimensions.map((dimension) => dimension.slug)
            )
            const excludedSlugs = dataSlugs.filter(
                (slug) => !dimensionSlugs.has(slug)
            )
            return Promise.resolve(
                appendSelectedEntityColors(
                    applyDimensionDisplayAndConversionFactor(
                        table.dropColumns(excludedSlugs),
                        dimensions
                    ),
                    selectedEntityColors
                )
            )
        },
    }
}

/** `tableIndicatorStore` for a CSV string, parsed with `columnDefs` */
export function csvIndicatorStore(options: {
    csv: string
    columnDefs?: OwidColumnDef[]
    name?: string
}): IndicatorStore {
    return tableIndicatorStore(
        new OwidTable(options.csv, options.columnDefs ?? []),
        { name: options.name }
    )
}
