/**
 * Where the chart editor gets indicator data and metadata from.
 *
 * A chart's dimensions name their columns either by OWID `variableId`,
 * fetched from the Data API, or by `slug` into a table the host already has.
 * A store is what makes one of those work: it hands the editor a table with
 * the columns its dimensions refer to, columnDefs (name, unit, description,
 * sources) attached, and tells the picker which columns exist.
 *
 * Column metadata is read-only in the editor under every store: it belongs to
 * the source, not to the chart.
 */
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnSlug,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidTableSlugs,
} from "@ourworldindata/types"
import { getCachingInputTableFetcher } from "@ourworldindata/grapher"
import { IndicatorCatalog } from "./editorProviders.js"
import { Dataset, IndicatorCatalogData } from "./EditorDatabase.js"

type SelectedEntityColors =
    | { [entityName: string]: string | undefined }
    | undefined

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
        selectedEntityColors: SelectedEntityColors
    ): Promise<OwidTable | undefined>
    /**
     * Well-known indicators the Basic tab offers as shortcuts (population,
     * GDP per capita), keyed by catalog path. Absent → no shortcuts.
     */
    variableIdsByCatalogPath?: Record<string, number | null>
}

/**
 * OWID's indicator store: `variableId`s resolved against the Data API, so
 * charts reference indicators exactly as they do in the database. Search is
 * whatever catalog the host has; the admin uses its own API for that.
 */
export function dataApiIndicatorStore(options: {
    dataApiUrl: string
    catalog?: IndicatorCatalog
    variableIdsByCatalogPath?: Record<string, number | null>
}): IndicatorStore {
    const fetchTable = getCachingInputTableFetcher(
        options.dataApiUrl,
        undefined,
        true
    )
    return {
        catalog: options.catalog,
        variableIdsByCatalogPath: options.variableIdsByCatalogPath,
        loadTable: (dimensions, selectedEntityColors) =>
            fetchTable(dimensions, selectedEntityColors),
    }
}

// The columns every OWID table has for its shape (entity, time). Everything
// else is a column a config may reference.
const STRUCTURAL_SLUGS = new Set<string>(Object.values(OwidTableSlugs))

/**
 * A store over a table the host already has (parsed CSV, in-memory data).
 * Its dimensions name columns by `slug`, so the table is served as it is and
 * the picker offers its columns.
 */
export function tableIndicatorStore(
    table: OwidTable,
    options: { name?: string } = {}
): IndicatorStore {
    const name = options.name ?? "Table"
    // Categorical columns included: a scatter's colour dimension may well be
    // a string column such as "continent".
    const slugs = table.columnSlugs.filter(
        (slug) => !STRUCTURAL_SLUGS.has(slug)
    )

    // Columns without a display name would show up as their slug anyway, but
    // the picker reads `displayName`, so fill it in.
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
        // The picker keys its rows by id; a column's address is its slug.
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
                    // Plotting a column the table doesn't have would silently
                    // show something else, or nothing; say which one.
                    console.warn(
                        `${name}: config references column "${dimension.slug ?? dimension.variableId}", which the table doesn't have`
                    )
            return Promise.resolve(dimensions.length ? named : undefined)
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
