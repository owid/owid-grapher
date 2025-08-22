import {
    ExplorerProgram,
    ExplorerGrammar,
    ColumnGrammar,
} from "@ourworldindata/explorer"
import { KnexReadonlyTransaction } from "../db.js"
import { getVariableIdsByCatalogPath } from "./Variable.js"
import {
    CoreTable,
    ErrorValueTypes,
    isNotErrorValueOrEmptyCell,
} from "@ourworldindata/core-table"
import { ColumnTypeNames } from "@ourworldindata/types"

export const transformExplorerProgramToResolveCatalogPaths = async (
    program: ExplorerProgram,
    knex: KnexReadonlyTransaction,
    errorReporter?: (error: Error) => Promise<void>
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
    const missingCatalogPaths: string[] = []
    const newDecisionMatrixTable =
        decisionMatrix.tableWithOriginalColumnNames.replaceCells(
            colSlugsToUpdate,
            (val) => {
                if (typeof val === "string" && val !== "") {
                    const catalogPaths = val.split(" ")
                    const indicatorIds = catalogPaths.map(
                        (catalogPath) =>
                            catalogPathToIndicatorIdMap
                                .get(catalogPath)
                                ?.toString() ?? catalogPath
                    )

                    const unresolvedCatalogPaths = catalogPaths.filter(
                        (path, index) => path === indicatorIds[index]
                    )
                    if (unresolvedCatalogPaths.length > 0) {
                        missingCatalogPaths.push(...unresolvedCatalogPaths)
                    }

                    return indicatorIds.join(" ")
                }
                return val
            }
        )

    // Log unresolved catalog paths if any
    if (missingCatalogPaths.length > 0) {
        const error = new Error(
            `Not all catalog paths resolved to indicator ids for the explorer with slug "${program.slug}": ${missingCatalogPaths.join(", ")}.`
        )
        if (errorReporter) {
            await errorReporter(error)
        } else {
            console.error(error.message)
        }
    }

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

        // Combine the variableId and catalogPath columns into a single variableId column.
        // During the combination, catalog paths are mapped to their corresponding indicator ID
        let newColumnDefsTable = columnDefTable.combineColumns(
            [
                ColumnGrammar.variableId.keyword,
                ColumnGrammar.catalogPath.keyword,
            ],
            {
                slug: ColumnGrammar.variableId.keyword,
                type: ColumnTypeNames.Integer,
            },
            (row) => {
                const variableId = row[ColumnGrammar.variableId.keyword].value
                if (isNotErrorValueOrEmptyCell(variableId)) return variableId

                const catalogPath = row[ColumnGrammar.catalogPath.keyword].value
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

        // Map catalog paths in the transform column to their corresponding indicator IDs
        if (
            columnDefTable.columnSlugs.includes(ColumnGrammar.transform.keyword)
        ) {
            newColumnDefsTable = newColumnDefsTable.replaceCells(
                [ColumnGrammar.transform.keyword],
                (transformString) => {
                    if (
                        isNotErrorValueOrEmptyCell(transformString) &&
                        typeof transformString === "string"
                    ) {
                        const words = transformString.split(" ")
                        const transformedWords = words.map(
                            (maybeCatalogPath) =>
                                catalogPathToIndicatorIdMap
                                    .get(maybeCatalogPath)
                                    ?.toString() ?? maybeCatalogPath
                        )
                        return transformedWords.join(" ")
                    } else {
                        return transformString
                    }
                }
            )
        }

        newProgram.updateBlock(lineNoInProgram, newColumnDefsTable.toMatrix())
    })

    return { program: newProgram.clone, unresolvedCatalogPaths }
}
