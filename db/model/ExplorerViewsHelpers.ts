import * as db from "../db.js"
import {
    ExplorerChartCreationMode,
    ExplorerProgram,
    ExplorerGrapherInterface,
} from "@ourworldindata/explorer"
import {
    CoreRow,
    DimensionProperty,
    GrapherInterface,
    OwidChartDimensionInterface,
    OwidColumnDef,
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
import { getChartConfigById } from "./Chart.js"
import { getMergedGrapherConfigForVariable } from "./Variable.js"
import * as R from "remeda"

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
    if (!grapherId) return undefined
    const chartConfig = await getChartConfigById(knex, grapherId)
    if (!chartConfig) {
        return undefined
    }
    return chartConfig.config
}

async function getVariableGrapherConfigForExplorerRow(
    knex: db.KnexReadonlyTransaction,
    explorerRow: ExplorerGrapherInterface
): Promise<GrapherInterface | undefined> {
    const yVariableId = getPrimaryYVariableId(explorerRow)
    if (!yVariableId) return undefined
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

    if (!grapherRow.yVariableIds) {
        throw new Error(
            "yVariableIds is required for variable-based explorer charts"
        )
    }
    const yVariableIds: string[] = grapherRow.yVariableIds.split(" ")
    const variableIds: OwidChartDimensionInterface[] = [
        ...yVariableIds.map((id) => {
            const variableId = parseIntOrUndefined(id)
            if (!variableId) {
                throw new Error(`Invalid variableId: ${id}`)
            }
            return {
                property: DimensionProperty.y,
                variableId,
            }
        }),
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

    if (variableIds.length === 0) {
        throw new Error("No valid variable IDs found for dimensions")
    }

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
    if (!grapherRow.tableSlug) {
        throw new Error("tableSlug is required for table-based explorer charts")
    }

    const colDefsForTableSlug = explorerProgram.columnDefsByTableSlug.get(
        grapherRow.tableSlug
    )
    if (!colDefsForTableSlug) {
        throw new Error(
            `No column definitions found for table slug: ${grapherRow.tableSlug}`
        )
    }

    const colDefBySlug = new Map(
        colDefsForTableSlug.map((colDef) => [colDef.slug, colDef])
    )

    if (!grapherRow.ySlugs) {
        throw new Error("ySlugs is required for table-based explorer charts")
    }
    const ySlugs: string[] = grapherRow.ySlugs.split(" ")
    const slugs: RequiredBy<
        PartialBy<OwidChartDimensionInterface, "variableId">,
        "slug"
    >[] = [
        ...ySlugs.map((slug) => ({ property: DimensionProperty.y, slug })),
        { property: DimensionProperty.x, slug: grapherRow.xSlug },
        { property: DimensionProperty.color, slug: grapherRow.colorSlug },
        { property: DimensionProperty.size, slug: grapherRow.sizeSlug },
    ].filter((dim) => dim.slug)

    if (slugs.length === 0) {
        throw new Error("No valid slugs found for dimensions")
    }

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

export async function constructGrapherConfig(
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

    // Throw error for invalid grapher IDs when using FromGrapherId mode
    if (mode === ExplorerChartCreationMode.FromGrapherId && !baseGrapherConfig) {
        const grapherId = parsedGrapherRow.grapherId
        throw new Error(`Invalid grapher ID: ${grapherId}. Chart with this ID does not exist.`)
    }

    // construct the config's dimensions array from the explorer's columns section
    const dimensions = constructDimensionsForMode(
        mode,
        explorerProgram,
        grapherRow
    )

    const mergedConfig = mergeGrapherConfigs(
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

    if (!mergedConfig) {
        throw new Error("Failed to merge grapher configs")
    }

    return mergedConfig
}
