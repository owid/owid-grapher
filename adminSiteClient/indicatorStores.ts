import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnSlug,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidTableSlugs,
    SelectedEntityColors,
} from "@ourworldindata/types"
import {
    applyDimensionDisplayAndConversionFactor,
    getCachingInputTableFetcher,
} from "@ourworldindata/grapher"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
} from "../adminShared/search.js"
import { CatalogIndicator, IndicatorCatalog } from "./editorProviders.js"

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
    const catalog: IndicatorCatalog = {
        fields: [],
        initialQuery: () => "",
        search: (query) => {
            const matches = filterFunctionForSearchWords(
                buildSearchWordsFromSearchString(query),
                (indicator: CatalogIndicator) => [
                    indicator.name,
                    indicator.column.slug,
                ]
            )
            const variables = indicators.filter(matches)
            return Promise.resolve({
                datasets: variables.length
                    ? [
                          {
                              id: 1,
                              name: datasetName,
                              matchCount: variables.length,
                              variables,
                          },
                      ]
                    : [],
                unit: "datasets",
                total: variables.length ? 1 : 0,
                pageSize: 1,
            })
        },
    }

    const isDataColumn = (slug: ColumnSlug | undefined): boolean =>
        slug !== undefined && dataSlugs.includes(slug)

    return {
        catalog,

        loadTable: (dimensions) => {
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
                applyDimensionDisplayAndConversionFactor(
                    table.dropColumns(excludedSlugs),
                    dimensions
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
