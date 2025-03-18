import fs from "fs-extra"
import path from "path"
import {
    ExplorerProgram,
    ExplorerGrammar,
    ColumnGrammar,
    explorerUrlMigrationsById,
} from "@ourworldindata/explorer"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { explorerRedirectTable } from "../explorerAdminServer/ExplorerRedirects.js"
import { renderExplorerPage } from "./siteRenderers.js"
import * as db from "../db/db.js"
import { getVariableIdsByCatalogPath } from "../db/model/Variable.js"
import {
    CoreTable,
    ErrorValueTypes,
    isNotErrorValueOrEmptyCell,
} from "@ourworldindata/core-table"
import { ColumnTypeNames } from "@ourworldindata/types"

export const transformExplorerProgramToResolveCatalogPaths = async (
    program: ExplorerProgram,
    knex: db.KnexReadonlyTransaction
): Promise<{
    program: ExplorerProgram
    unresolvedCatalogPaths?: Set<string>
}> => {
    const { decisionMatrix } = program
    const { requiredCatalogPaths } = decisionMatrix

    if (requiredCatalogPaths.size === 0) return { program }

    const catalogPathToIndicatorIdMap = await getVariableIdsByCatalogPath(
        [...requiredCatalogPaths],
        knex
    )
    const unresolvedCatalogPaths = new Set(
        [...requiredCatalogPaths].filter(
            (path) => !catalogPathToIndicatorIdMap.get(path)
        )
    )

    const colSlugsToUpdate =
        decisionMatrix.allColumnsWithIndicatorIdsOrCatalogPaths.map(
            (col) => col.slug
        )
    // In the decision matrix table, replace any catalog paths with their corresponding indicator ids
    // If a catalog path is not found, it will be left as is
    const newDecisionMatrixTable =
        decisionMatrix.tableWithOriginalColumnNames.replaceCells(
            colSlugsToUpdate,
            (val) => {
                if (typeof val === "string") {
                    const vals = val.split(" ")
                    const updatedVals = vals.map(
                        (val) =>
                            catalogPathToIndicatorIdMap.get(val)?.toString() ??
                            val
                    )
                    return updatedVals.join(" ")
                }
                return val
            }
        )

    // Write the result to the "graphers" block
    const grapherBlockLine = program.getRowMatchingWords(
        ExplorerGrammar.graphers.keyword
    )
    if (grapherBlockLine === -1)
        throw new Error(
            `"graphers" block not found in explorer ${program.slug}`
        )
    const newProgram = program.updateBlock(
        grapherBlockLine,
        newDecisionMatrixTable.toMatrix()
    )

    // Next, we also need to update the "columns" block of the explorer
    program.columnDefsByTableSlug.forEach((_columnDefs, tableSlug) => {
        const lineNoInProgram = newProgram.getRowMatchingWords(
            ExplorerGrammar.columns.keyword,
            tableSlug
        )
        // This should, in theory, never happen because columnDefsByTableSlug gets generated from such a block
        if (lineNoInProgram === -1)
            throw new Error(
                `Column defs not found for explorer ${program.slug} and table ${tableSlug}`
            )
        const columnDefTable = new CoreTable(
            newProgram.getBlock(lineNoInProgram)
        )
        const newColumnDefsTable = columnDefTable.combineColumns(
            [
                ColumnGrammar.variableId.keyword,
                ColumnGrammar.catalogPath.keyword,
            ],
            {
                slug: ColumnGrammar.variableId.keyword,
                type: ColumnTypeNames.Integer,
            },
            (row) => {
                const variableId = row[ColumnGrammar.variableId.keyword]
                if (isNotErrorValueOrEmptyCell(variableId)) return variableId

                const catalogPath = row[ColumnGrammar.catalogPath.keyword]
                if (
                    isNotErrorValueOrEmptyCell(catalogPath) &&
                    typeof catalogPath === "string"
                ) {
                    return (
                        catalogPathToIndicatorIdMap.get(catalogPath) ??
                        ErrorValueTypes.NoMatchingVariableId
                    )
                }
                return ErrorValueTypes.NoMatchingVariableId
            }
        )
        newProgram.updateBlock(lineNoInProgram, newColumnDefsTable.toMatrix())
    })

    return { program: newProgram.clone, unresolvedCatalogPaths }
}

export const bakeAllPublishedExplorers = async (
    outputFolder: string,
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadonlyTransaction
) => {
    // remove all existing explorers, since we're re-baking every single one anyway
    await fs.remove(outputFolder)
    await fs.mkdirp(outputFolder)

    const published = await explorerAdminServer.getAllPublishedExplorers(knex)
    await bakeExplorersToDir(outputFolder, published, knex)
}

const bakeExplorersToDir = async (
    directory: string,
    explorers: ExplorerProgram[] = [],
    knex: db.KnexReadonlyTransaction
) => {
    for (const explorer of explorers) {
        await write(
            `${directory}/${explorer.slug}.html`,
            await renderExplorerPage(explorer, knex)
        )
    }
}

export const bakeAllExplorerRedirects = async (
    outputFolder: string,
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadonlyTransaction
) => {
    const explorers = await explorerAdminServer.getAllExplorers(knex)
    const redirects = explorerRedirectTable.rows
    for (const redirect of redirects) {
        const { migrationId, path: redirectPath, baseQueryStr } = redirect
        const transform = explorerUrlMigrationsById[migrationId]
        if (!transform) {
            throw new Error(
                `No explorer URL migration with id '${migrationId}'. Fix the list of explorer redirects and retry.`
            )
        }
        const { explorerSlug } = transform
        const program = explorers.find(
            (program) => program.slug === explorerSlug
        )
        if (!program) {
            throw new Error(
                `No explorer with slug '${explorerSlug}'. Fix the list of explorer redirects and retry.`
            )
        }
        const html = await renderExplorerPage(program, knex, {
            urlMigrationSpec: {
                explorerUrlMigrationId: migrationId,
                baseQueryStr,
            },
        })
        await write(path.join(outputFolder, `${redirectPath}.html`), html)
    }
}

// todo: merge with SiteBaker's?
const write = async (outPath: string, content: string) => {
    await fs.mkdirp(path.dirname(outPath))
    await fs.writeFile(outPath, content)
    console.log(outPath)
}
