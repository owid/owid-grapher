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
    /** Indicators the picker can offer. Absent → no "Add indicator". */
    catalog?: IndicatorCatalog
    /**
     * A table holding the columns for these dimensions, keyed by
     * `variableId` or `slug` as each dimension names them. May return
     * `undefined` when nothing changed since the last call, in which case
     * the editor keeps the table it has.
     */
    loadTable(
        dimensions: OwidChartDimensionInterface[],
        selectedEntityColors: SelectedEntityColors | undefined
    ): Promise<OwidTable | undefined>
}

/**
 * OWID's indicator store: `variableId`s resolved against the Data API
 */
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

const STRUCTURAL_SLUGS = new Set<string>(Object.values(OwidTableSlugs))

/**
 * A store over a table the host already has (parsed CSV, in-memory data).
 * Its dimensions name columns by `slug`.
 */
export function tableIndicatorStore(
    table: OwidTable,
    options: { name?: string } = {}
): IndicatorStore {
    const name = options.name ?? "Table"
    const slugs = table.columnSlugs.filter(
        (slug) => !STRUCTURAL_SLUGS.has(slug)
    )

    const named = table.updateDefs((def: OwidColumnDef) =>
        def.name ? def : { ...def, name: def.slug }
    )

    const dataset: Dataset = {
        id: 1,
        name,
        namespace: name,
        version: undefined,
        isPrivate: false,
        nonRedistributable: false,
        variables: slugs.map((slug, i) => ({
            id: i + 1,
            slug,
            name: named.get(slug).displayName,
        })),
    }
    const catalogData: IndicatorCatalogData = {
        namespaces: [{ name, isArchived: false }],
        datasets: [dataset],
    }

    const has = (slug: ColumnSlug | undefined): boolean =>
        slug !== undefined && slugs.includes(slug)

    return {
        catalog: { load: () => Promise.resolve(catalogData) },

        loadTable: (dimensions) => {
            for (const dimension of dimensions)
                if (!has(dimension.slug))
                    console.warn(
                        `${name}: config references column "${dimension.slug ?? dimension.variableId}", which the table doesn't have`
                    )
            return Promise.resolve(
                dimensions.length
                    ? applyDimensionDisplayAndConversionFactor(
                          named,
                          dimensions
                      )
                    : undefined
            )
        },
    }
}

/** `tableIndicatorStore` over a CSV string, parsed with the given column defs. */
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
