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
import { IndicatorCatalog } from "./editorProviders.js"
import { Dataset, IndicatorCatalogData } from "./EditorDatabase.js"

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

    const tableWithColumnNames = table.updateDefs((def: OwidColumnDef) =>
        def.name ? def : { ...def, name: def.slug }
    )

    const dataset: Dataset = {
        id: 1,
        name: datasetName,
        namespace: datasetName,
        version: undefined,
        isPrivate: false,
        nonRedistributable: false,
        variables: dataSlugs.map((slug, i) => ({
            id: i + 1,
            slug,
            name: tableWithColumnNames.get(slug).displayName,
        })),
    }
    const catalogData: IndicatorCatalogData = {
        namespaces: [{ name: datasetName, isArchived: false }],
        datasets: [dataset],
    }

    const isDataColumn = (slug: ColumnSlug | undefined): boolean =>
        slug !== undefined && dataSlugs.includes(slug)

    return {
        catalog: { load: () => Promise.resolve(catalogData) },

        loadTable: (dimensions) => {
            for (const dimension of dimensions)
                if (!isDataColumn(dimension.slug))
                    console.warn(
                        `${datasetName}: config references column "${dimension.slug ?? dimension.variableId}", which the table doesn't have`
                    )
            return Promise.resolve(
                applyDimensionDisplayAndConversionFactor(
                    tableWithColumnNames,
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
