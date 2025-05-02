import {
    ExplorerChartCreationMode,
    ExplorerProgram,
    ExplorerGrapherInterface,
} from "@ourworldindata/explorer"
import * as db from "./db.js"
import {
    CoreRow,
    DbPlainExplorer,
    DimensionProperty,
    GrapherInterface,
    OwidChartDimensionInterface,
    OwidColumnDef,
    DbInsertExplorerView,
    serializeChartConfig,
} from "@ourworldindata/types"
import {
    excludeUndefined,
    mergeGrapherConfigs,
    omitUndefinedValues,
    parseIntOrUndefined,
    PartialBy,
    RequiredBy,
} from "@ourworldindata/utils"
import { defaultGrapherConfig } from "@ourworldindata/grapher"
import { transformExplorerProgramToResolveCatalogPaths } from "../baker/ExplorerBaker.js"
import { getChartConfigById } from "./model/Chart.js"
import { getMergedGrapherConfigForVariable } from "./model/Variable.js"
import * as R from "remeda"

// This scrips constructs Grapher configs for every view in an explorer.
// The constructed Grapher configs are an approximation of the actual Grapher
// configs; they are not guaranteed to be complete or correct. In particular,
// - column transforms, including the `duplicate` transform, are not taken into account
// - the dimension's `display` field doesn't necessarily doesn't adhere to the schema;
// (e.g. it simply contains all specified fields in the columns section)

function columnDefToDimensionObject(
    colDef?: OwidColumnDef
): Partial<OwidChartDimensionInterface> {
    if (!colDef) return {}
    return omitUndefinedValues({
        variableId: colDef.owidVariableId,
        slug: colDef.slug,
        // pipe all fields of the explorer's column grammar into the display field
        // this is not necessarilly correct; we need to add a translation step here
        display: R.omit(colDef, ["slug", "owidVariableId", "catalogPath"]),
    })
}

function getPrimaryYVariableId(
    explorerRow: ExplorerGrapherInterface
): number | undefined {
    const yVariableIdsList: number[] = explorerRow.yVariableIds
        ? excludeUndefined(
              explorerRow.yVariableIds.split(" ").map(parseIntOrUndefined)
          )
        : []
    return yVariableIdsList[0]
}

async function getGrapherConfigByIdForExplorerRow(
    knex: db.KnexReadonlyTransaction,
    explorerRow: ExplorerGrapherInterface
): Promise<GrapherInterface | undefined> {
    const { grapherId } = explorerRow
    if (!grapherId) return
    return (await getChartConfigById(knex, grapherId))?.config
}

async function getVariableGrapherConfigForExplorerRow(
    knex: db.KnexReadonlyTransaction,
    explorerRow: ExplorerGrapherInterface
): Promise<GrapherInterface | undefined> {
    const yVariableId = getPrimaryYVariableId(explorerRow)
    if (!yVariableId) return
    return getMergedGrapherConfigForVariable(knex, yVariableId)
}

async function fetchBaseGrapherConfigForMode(
    knex: db.KnexReadonlyTransaction,
    mode: ExplorerChartCreationMode,
    explorerRow: ExplorerGrapherInterface
): Promise<GrapherInterface | undefined> {
    switch (mode) {
        case ExplorerChartCreationMode.FromGrapherId:
            return getGrapherConfigByIdForExplorerRow(knex, explorerRow)
        case ExplorerChartCreationMode.FromVariableIds:
            return getVariableGrapherConfigForExplorerRow(knex, explorerRow)
        case ExplorerChartCreationMode.FromExplorerTableColumnSlugs:
            // csv-based explorers only rely on the explorer config
            return
    }
}

function constructDimensionsForVariableIds(
    explorerProgram: ExplorerProgram,
    grapherRow: CoreRow
): OwidChartDimensionInterface[] | undefined {
    const colDefs = explorerProgram.columnDefsWithoutTableSlug
    const colDefByVariableId = new Map(
        colDefs.map((colDef) => [colDef.owidVariableId, colDef])
    )

    const yVariableIds: string[] = grapherRow.yVariableIds?.split(" ") ?? []
    const variableIds: OwidChartDimensionInterface[] = [
        ...yVariableIds.map((id) => ({
            property: DimensionProperty.y,
            variableId: parseIntOrUndefined(id),
        })),
        {
            property: DimensionProperty.x,
            variableId: parseIntOrUndefined(grapherRow.xVariableId),
        },
        {
            property: DimensionProperty.color,
            variableId: parseIntOrUndefined(grapherRow.colorVariableId),
        },
        {
            property: DimensionProperty.size,
            variableId: parseIntOrUndefined(grapherRow.sizeVariableId),
        },
    ].filter((obj): obj is OwidChartDimensionInterface => !!obj.variableId)

    const dimensions = variableIds.map(({ property, variableId }) => ({
        variableId,
        property,
        ...columnDefToDimensionObject(colDefByVariableId.get(variableId)),
    }))

    return dimensions
}

function constructDimensionsForTableColumnSlugs(
    explorerProgram: ExplorerProgram,
    grapherRow: CoreRow
): PartialBy<OwidChartDimensionInterface, "variableId">[] | undefined {
    const colDefsForTableSlug = explorerProgram.columnDefsByTableSlug.get(
        grapherRow.tableSlug
    )
    const colDefBySlug = new Map(
        colDefsForTableSlug?.map((colDef) => [colDef.slug, colDef]) ?? []
    )

    const ySlugs: string[] = grapherRow.ySlugs?.split(" ") ?? []
    const slugs: RequiredBy<
        PartialBy<OwidChartDimensionInterface, "variableId">,
        "slug"
    >[] = [
        ...ySlugs.map((slug) => ({ property: DimensionProperty.y, slug })),
        { property: DimensionProperty.x, slug: grapherRow.xSlug },
        { property: DimensionProperty.color, slug: grapherRow.colorSlug },
        { property: DimensionProperty.size, slug: grapherRow.sizeSlug },
    ].filter((dim) => dim.slug)

    const dimensions = slugs.map(({ property, slug }) => ({
        slug,
        property,
        ...columnDefToDimensionObject(colDefBySlug.get(slug)),
    }))

    return dimensions
}

function constructDimensionsForMode(
    mode: ExplorerChartCreationMode,
    explorerProgram: ExplorerProgram,
    grapherRow: CoreRow
): PartialBy<OwidChartDimensionInterface, "variableId">[] | undefined {
    switch (mode) {
        case ExplorerChartCreationMode.FromGrapherId:
            // grapher id based explorers don't support metadata overwrites
            return

        case ExplorerChartCreationMode.FromVariableIds:
            return constructDimensionsForVariableIds(
                explorerProgram,
                grapherRow
            )

        case ExplorerChartCreationMode.FromExplorerTableColumnSlugs:
            return constructDimensionsForTableColumnSlugs(
                explorerProgram,
                grapherRow
            )
    }
}

async function constructGrapherConfig(
    knex: db.KnexReadonlyTransaction,
    explorerProgram: ExplorerProgram,
    grapherRow: CoreRow
): Promise<GrapherInterface> {
    // corresponds to a grapher row in the explorer config, i.e. contains
    // choice params as well as explorer-flavoured grapher config
    const parsedGrapherRow =
        explorerProgram.constructExplorerGrapherConfig(grapherRow)

    // translate explorer-flavoured grapher config to a valid grapher interface
    const grapherConfigOverwrites =
        explorerProgram.constructGrapherConfig(parsedGrapherRow)

    // available modes: csv-based, indicator-based or grapher id-based
    const mode =
        explorerProgram.getChartCreationModeForExplorerGrapherConfig(
            parsedGrapherRow
        )

    // fetch the underlying grapher config or variable config if necessary
    const baseGrapherConfig = await fetchBaseGrapherConfigForMode(
        knex,
        mode,
        parsedGrapherRow
    )

    // construct the config's dimensions array from the explorer's columns section
    const dimensions = constructDimensionsForMode(
        mode,
        explorerProgram,
        grapherRow
    )

    return mergeGrapherConfigs(
        // variable-level config or config of the specified grapher id
        baseGrapherConfig ?? {},
        // grapher config specified in the explorer config
        grapherConfigOverwrites ?? {},
        // selection specified as global setting in the explorer config
        {
            $schema: defaultGrapherConfig.$schema,
            selectedEntityNames: explorerProgram.selection,
        },
        // chart dimensions
        // @ts-expect-error csv-based explorers don't use variable ids
        { $schema: defaultGrapherConfig.$schema, dimensions }
    )
}

async function fetchPublishedExplorers(
    knex: db.KnexReadonlyTransaction
): Promise<Pick<DbPlainExplorer, "slug" | "tsv">[]> {
    return db.knexRaw(
        knex,
        `-- sql
            SELECT slug, tsv
            FROM explorers
            WHERE isPublished IS TRUE
        `
    )
}

async function prepareGrapherConfigsForExplorerViews(
    knex: db.KnexReadWriteTransaction
): Promise<void> {
    await db.knexRaw(knex, "TRUNCATE TABLE explorer_views")

    const explorers = await fetchPublishedExplorers(knex)

    for (const explorer of explorers) {
        console.info("Processing... " + explorer.slug)

        const explorerViews: DbInsertExplorerView[] = []

        // init explorer program
        const rawExplorerProgram = new ExplorerProgram(
            explorer.slug,
            explorer.tsv
        )

        // map catalog paths to indicator ids if necessary
        const explorerProgram = (
            await transformExplorerProgramToResolveCatalogPaths(
                rawExplorerProgram,
                knex
            )
        ).program

        // iterate over all grapher rows in the explorer and construct a
        // grapher config for every row
        const grapherRows = explorerProgram.decisionMatrix.table.rows
        for (const grapherRow of grapherRows) {
            const view =
                explorerProgram.decisionMatrix.getChoiceParamsForRow(grapherRow)

            const config = await constructGrapherConfig(
                knex,
                explorerProgram,
                grapherRow
            )

            explorerViews.push({
                explorerSlug: explorer.slug,
                explorerView: JSON.stringify(view),
                grapherConfig: serializeChartConfig(config),
            })
        }

        await knex.transaction(async (trx) => {
            await trx.batchInsert("explorer_views", explorerViews)
        })
    }
}

const main = async (): Promise<void> => {
    try {
        await db.knexReadWriteTransaction(
            (trx) => prepareGrapherConfigsForExplorerViews(trx),
            db.TransactionCloseMode.Close
        )
    } catch (e) {
        console.error(e)
    }
}

void main()
