/**
 * Where the chart editor gets indicator data and metadata from.
 *
 * Grapher can address the columns it plots in two ways: OWID's `dimensions[]`
 * with a numeric `variableId` that is fetched from the Data API, or plain
 * column slugs (`ySlugs`, `xSlug`, ...) into a table the host already has,
 * which is what `GrapherLoader.fromCsv` / `fromTable` use. The editor's UI is
 * built around the first form (the picker, the dimension cards, the data tab
 * all think in numeric keys), so an `IndicatorStore` does two jobs:
 *
 *  - hand the editor a table with the columns its dimensions refer to, with
 *    columnDefs (name, unit, description, sources) attached, and
 *  - translate between the host's config and the editor's dimension-based one.
 *
 * For OWID the store is the Data API and both translations are the identity.
 * For a CSV, the store assigns each numeric column a key, serves the table
 * with its columns renamed to those keys, and writes slugs back into the
 * config on the way out. Column metadata is read-only in the editor under
 * every store: it belongs to the source, not to the chart.
 */
import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import {
    DimensionProperty,
    GrapherInterface,
    OwidChartDimensionInterface,
    OwidColumnDef,
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
     * `variableId`. May return `undefined` when nothing changed since the
     * last call, in which case the editor keeps the table it has.
     */
    loadTable(
        dimensions: OwidChartDimensionInterface[],
        selectedEntityColors: SelectedEntityColors
    ): Promise<OwidTable | undefined>
    /**
     * The grapher config an indicator carries, which charts built on it
     * inherit from. Absent → the editor shows no inheritance.
     */
    loadIndicatorConfig?(
        variableId: number
    ): Promise<GrapherInterface | undefined>
    /** The host's config → the dimension-based one the editor works on. */
    toEditorConfig(config: GrapherInterface): GrapherInterface
    /** The editor's config → what the host stores and renders with. */
    fromEditorConfig(config: GrapherInterface): GrapherInterface
}

/**
 * OWID's indicator store: `variableId`s resolved against the Data API, so
 * charts reference indicators exactly as they do in the database. Search is
 * whatever catalog the host has; the admin uses its own API for that.
 */
export function dataApiIndicatorStore(options: {
    dataApiUrl: string
    catalog?: IndicatorCatalog
    loadIndicatorConfig?: (
        variableId: number
    ) => Promise<GrapherInterface | undefined>
}): IndicatorStore {
    const fetchTable = getCachingInputTableFetcher(
        options.dataApiUrl,
        undefined,
        true
    )
    return {
        catalog: options.catalog,
        loadIndicatorConfig: options.loadIndicatorConfig,
        loadTable: (dimensions, selectedEntityColors) =>
            fetchTable(dimensions, selectedEntityColors),
        toEditorConfig: (config) => config,
        fromEditorConfig: (config) => config,
    }
}

const SLUG_PROPERTIES: {
    property: DimensionProperty
    field: "ySlugs" | "xSlug" | "sizeSlug" | "colorSlug"
}[] = [
    { property: DimensionProperty.y, field: "ySlugs" },
    { property: DimensionProperty.x, field: "xSlug" },
    { property: DimensionProperty.size, field: "sizeSlug" },
    { property: DimensionProperty.color, field: "colorSlug" },
]

/**
 * A store over a table the host already has (parsed CSV, in-memory data).
 * Configs reference columns by slug; the editor sees each numeric column as
 * an indicator with a stable key, and the table it gets has its columns
 * renamed to those keys so grapher resolves `variableId` → column as usual.
 */
export function tableIndicatorStore(
    table: OwidTable,
    options: { name?: string } = {}
): IndicatorStore {
    const name = options.name ?? "Table"
    const slugs = table.numericColumnSlugs
    const keyBySlug = new Map(slugs.map((slug, i) => [slug, i + 1]))
    const slugByKey = new Map(slugs.map((slug, i) => [i + 1, slug]))

    // Columns without a display name would show up as their key, so fall
    // back to the slug before renaming.
    const keyedTable = table
        .updateDefs((def: OwidColumnDef) =>
            def.name ? def : { ...def, name: def.slug }
        )
        .renameColumns(
            Object.fromEntries(
                slugs.map((slug) => [slug, String(keyBySlug.get(slug))])
            )
        )

    const dataset: Dataset = {
        id: 1,
        name,
        namespace: name,
        version: undefined,
        isPrivate: false,
        nonRedistributable: false,
        variables: slugs.map((slug) => ({
            id: keyBySlug.get(slug)!,
            name: table.get(slug).displayName,
        })),
    }
    const catalogData: IndicatorCatalogData = {
        namespaces: [{ name, isArchived: false }],
        datasets: [dataset],
    }

    const keyOf = (slug: string): number | undefined => keyBySlug.get(slug)
    const slugOf = (key: number): string | undefined => slugByKey.get(key)

    return {
        catalog: { load: () => Promise.resolve(catalogData) },

        loadTable: (dimensions) =>
            Promise.resolve(dimensions.length ? keyedTable : undefined),

        toEditorConfig(config) {
            const dimensions: OwidChartDimensionInterface[] = []
            for (const { property, field } of SLUG_PROPERTIES) {
                const value = config[field]
                if (!value) continue
                for (const slug of value.split(" ")) {
                    const key = keyOf(slug)
                    if (key !== undefined)
                        dimensions.push({ property, variableId: key })
                }
            }
            // Like GrapherLoader.fromTable: a config that names no columns
            // plots every numeric one.
            if (dimensions.length === 0)
                for (const slug of slugs)
                    dimensions.push({
                        property: DimensionProperty.y,
                        variableId: keyOf(slug)!,
                    })
            return {
                ..._.omit(config, ["ySlugs", "xSlug", "sizeSlug", "colorSlug"]),
                dimensions,
            }
        },

        fromEditorConfig(config) {
            const out: GrapherInterface = _.omit(config, ["dimensions"])
            for (const { property, field } of SLUG_PROPERTIES) {
                const slugsForProperty = (config.dimensions ?? [])
                    .filter((dim) => dim.property === property)
                    .map((dim) => slugOf(dim.variableId))
                    .filter((slug): slug is string => slug !== undefined)
                if (slugsForProperty.length)
                    out[field] = slugsForProperty.join(" ")
            }
            return out
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
