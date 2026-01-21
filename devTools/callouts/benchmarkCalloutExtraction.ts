/**
 * Benchmark script to compare callout value extraction methods:
 * - Old: GrapherState mutation per entity (populateFromQueryParams)
 * - New: Direct table extraction (constructGrapherValuesJsonFromTable)
 *
 * Usage:
 *   npx tsx devTools/callouts/benchmarkCalloutExtraction.ts <chart-slug> [entity-count]
 *
 * Examples:
 *   npx tsx devTools/callouts/benchmarkCalloutExtraction.ts life-expectancy
 *   npx tsx devTools/callouts/benchmarkCalloutExtraction.ts life-expectancy 50
 */

import * as db from "../../db/db.js"
import { getChartConfigById, mapSlugsToIds } from "../../db/model/Chart.js"
import { prepareCalloutChart } from "../../db/model/Gdoc/dataCallouts.js"
import {
    constructGrapherValuesJson,
    prepareCalloutTable,
    constructGrapherValuesJsonFromTable,
    fetchInputTableForConfig,
} from "@ourworldindata/grapher"
import { GrapherValuesJson } from "@ourworldindata/types"
import { DATA_API_URL } from "../../settings/serverSettings.js"

interface BenchmarkResult {
    method: string
    entityCount: number
    preparationTimeMs: number
    extractionTimeMs: number
    totalTimeMs: number
    perEntityExtractionMs: number
    values: Map<string, GrapherValuesJson>
}

async function benchmarkOldMethod(
    chartConfig: any,
    entityNames: string[],
    timeQueryParam?: string
): Promise<BenchmarkResult> {
    const values = new Map<string, GrapherValuesJson>()

    const prepStart = performance.now()
    const grapherState = await prepareCalloutChart(chartConfig)
    if (!grapherState) {
        throw new Error("Failed to prepare GrapherState")
    }
    const prepEnd = performance.now()
    const preparationTimeMs = prepEnd - prepStart

    const extractStart = performance.now()
    for (const entityName of entityNames) {
        // Simulate what happens in bakeCalloutsForUrls - update query params
        grapherState.populateFromQueryParams({
            country: entityName,
            time: timeQueryParam,
        })
        const result = constructGrapherValuesJson(
            grapherState,
            entityName,
            timeQueryParam
        )
        values.set(entityName, result)
    }
    const extractEnd = performance.now()
    const extractionTimeMs = extractEnd - extractStart

    return {
        method: "Old (GrapherState mutation)",
        entityCount: entityNames.length,
        preparationTimeMs,
        extractionTimeMs,
        totalTimeMs: preparationTimeMs + extractionTimeMs,
        perEntityExtractionMs: extractionTimeMs / entityNames.length,
        values,
    }
}

async function benchmarkNewMethod(
    chartConfig: any,
    entityNames: string[],
    timeQueryParam?: string
): Promise<BenchmarkResult> {
    const values = new Map<string, GrapherValuesJson>()

    const prepStart = performance.now()

    // Fetch the input table directly
    const inputTable = await fetchInputTableForConfig({
        dimensions: chartConfig.dimensions,
        dataApiUrl: DATA_API_URL,
    })

    if (!inputTable) {
        throw new Error("Failed to fetch input table")
    }

    // Prepare the table for batch extraction
    const prepared = prepareCalloutTable(inputTable, chartConfig)
    const prepEnd = performance.now()
    const preparationTimeMs = prepEnd - prepStart

    const extractStart = performance.now()
    for (const entityName of entityNames) {
        const result = constructGrapherValuesJsonFromTable(
            prepared,
            entityName,
            timeQueryParam
        )
        values.set(entityName, result)
    }
    const extractEnd = performance.now()
    const extractionTimeMs = extractEnd - extractStart

    return {
        method: "New (direct table)",
        entityCount: entityNames.length,
        preparationTimeMs,
        extractionTimeMs,
        totalTimeMs: preparationTimeMs + extractionTimeMs,
        perEntityExtractionMs: extractionTimeMs / entityNames.length,
        values,
    }
}

function formatResult(result: BenchmarkResult): string {
    return [
        `  ${result.method}:`,
        `    Entities: ${result.entityCount}`,
        `    Preparation: ${result.preparationTimeMs.toFixed(2)}ms`,
        `    Extraction: ${result.extractionTimeMs.toFixed(2)}ms`,
        `    Total: ${result.totalTimeMs.toFixed(2)}ms`,
        `    Per-entity extraction: ${result.perEntityExtractionMs.toFixed(4)}ms`,
    ].join("\n")
}

interface ValueDifference {
    entityName: string
    field: string
    oldValue: unknown
    newValue: unknown
}

function compareValues(
    oldValues: Map<string, GrapherValuesJson>,
    newValues: Map<string, GrapherValuesJson>
): { identical: number; different: number; differences: ValueDifference[] } {
    let identical = 0
    let different = 0
    const differences: ValueDifference[] = []

    for (const [entityName, oldValue] of oldValues) {
        const newValue = newValues.get(entityName)

        if (!newValue) {
            different++
            differences.push({
                entityName,
                field: "(missing)",
                oldValue: oldValue,
                newValue: undefined,
            })
            continue
        }

        // Compare the JSON representations
        // Note: We need to compare specific fields that should match
        // Some fields like valueLabel may differ (not available in direct table method)
        const fieldsToCompare = [
            "entityName",
            "startTime",
            "endTime",
            "source",
        ] as const

        let entityMatches = true

        for (const field of fieldsToCompare) {
            const oldFieldValue = oldValue[field]
            const newFieldValue = newValue[field]
            if (
                JSON.stringify(oldFieldValue) !== JSON.stringify(newFieldValue)
            ) {
                entityMatches = false
                differences.push({
                    entityName,
                    field,
                    oldValue: oldFieldValue,
                    newValue: newFieldValue,
                })
            }
        }

        // Compare columns
        const oldColumns = JSON.stringify(oldValue.columns)
        const newColumns = JSON.stringify(newValue.columns)
        if (oldColumns !== newColumns) {
            entityMatches = false
            differences.push({
                entityName,
                field: "columns",
                oldValue: oldValue.columns,
                newValue: newValue.columns,
            })
        }

        // Compare data point values (excluding valueLabel which isn't available in direct method)
        const compareDataPoints = (
            oldPoints: GrapherValuesJson["endValues"],
            newPoints: GrapherValuesJson["endValues"],
            prefix: string
        ) => {
            if (!oldPoints && !newPoints) return true
            if (!oldPoints || !newPoints) {
                differences.push({
                    entityName,
                    field: prefix,
                    oldValue: oldPoints,
                    newValue: newPoints,
                })
                return false
            }

            let matches = true

            // Compare y values
            const oldY = oldPoints.y || []
            const newY = newPoints.y || []
            if (oldY.length !== newY.length) {
                differences.push({
                    entityName,
                    field: `${prefix}.y.length`,
                    oldValue: oldY.length,
                    newValue: newY.length,
                })
                matches = false
            } else {
                for (let i = 0; i < oldY.length; i++) {
                    const oldPoint = oldY[i]
                    const newPoint = newY[i]
                    // Compare all fields except valueLabel
                    const pointFields = [
                        "columnSlug",
                        "value",
                        "formattedValue",
                        "formattedValueShort",
                        "formattedValueShortWithAbbreviations",
                        "time",
                        "formattedTime",
                    ] as const
                    for (const pf of pointFields) {
                        if (
                            JSON.stringify(oldPoint?.[pf]) !==
                            JSON.stringify(newPoint?.[pf])
                        ) {
                            differences.push({
                                entityName,
                                field: `${prefix}.y[${i}].${pf}`,
                                oldValue: oldPoint?.[pf],
                                newValue: newPoint?.[pf],
                            })
                            matches = false
                        }
                    }
                }
            }

            // Compare x value if present
            if (oldPoints.x || newPoints.x) {
                const oldX = oldPoints.x
                const newX = newPoints.x
                const pointFields = [
                    "columnSlug",
                    "value",
                    "formattedValue",
                    "formattedValueShort",
                    "formattedValueShortWithAbbreviations",
                    "time",
                    "formattedTime",
                ] as const
                for (const pf of pointFields) {
                    if (
                        JSON.stringify(oldX?.[pf]) !==
                        JSON.stringify(newX?.[pf])
                    ) {
                        differences.push({
                            entityName,
                            field: `${prefix}.x.${pf}`,
                            oldValue: oldX?.[pf],
                            newValue: newX?.[pf],
                        })
                        matches = false
                    }
                }
            }

            return matches
        }

        if (
            !compareDataPoints(
                oldValue.startValues,
                newValue.startValues,
                "startValues"
            )
        ) {
            entityMatches = false
        }
        if (
            !compareDataPoints(
                oldValue.endValues,
                newValue.endValues,
                "endValues"
            )
        ) {
            entityMatches = false
        }

        if (entityMatches) {
            identical++
        } else {
            different++
        }
    }

    return { identical, different, differences }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2)
    if (args.length < 1) {
        console.error(
            "Usage: npx tsx devTools/callouts/benchmarkCalloutExtraction.ts <chart-slug> [entity-count]"
        )
        process.exit(1)
    }

    const chartSlug = args[0]
    const entityCount = parseInt(args[1] || "200", 10)

    console.log(`\nBenchmarking callout extraction for chart: ${chartSlug}`)
    console.log(`Target entity count: ${entityCount}\n`)

    await db.knexReadonlyTransaction(async (trx) => {
        // Get chart config
        const slugToIdMap = await mapSlugsToIds(trx)
        const chartId = slugToIdMap[chartSlug]

        if (!chartId) {
            console.error(`Chart not found: ${chartSlug}`)
            process.exit(1)
        }

        const chartRecord = await getChartConfigById(trx, chartId)
        if (!chartRecord) {
            console.error(`Chart config not found for ID: ${chartId}`)
            process.exit(1)
        }

        const chartConfig = chartRecord.config
        console.log(`Chart ID: ${chartId}`)
        console.log(`Chart title: ${chartConfig.title || "(no title)"}\n`)

        // Fetch the input table to get available entities
        const inputTable = await fetchInputTableForConfig({
            dimensions: chartConfig.dimensions,
            dataApiUrl: DATA_API_URL,
        })

        if (!inputTable) {
            console.error("Failed to fetch input table")
            process.exit(1)
        }

        // Get entity names from the table
        const availableEntities = inputTable.availableEntityNames
        console.log(`Available entities in data: ${availableEntities.length}`)

        // Select entities for testing
        const testEntities = availableEntities.slice(0, entityCount)
        console.log(`Testing with ${testEntities.length} entities\n`)

        // Run benchmarks
        console.log("Running old method (GrapherState mutation)...")
        const oldResult = await benchmarkOldMethod(chartConfig, testEntities)
        console.log("Done.\n")

        console.log("Running new method (direct table extraction)...")
        const newResult = await benchmarkNewMethod(chartConfig, testEntities)
        console.log("Done.\n")

        // Print results
        console.log("=== RESULTS ===\n")
        console.log(formatResult(oldResult))
        console.log("")
        console.log(formatResult(newResult))
        console.log("")

        // Calculate speedup
        const extractionSpeedup =
            oldResult.perEntityExtractionMs / newResult.perEntityExtractionMs
        const totalSpeedup = oldResult.totalTimeMs / newResult.totalTimeMs

        console.log("=== PERFORMANCE COMPARISON ===\n")
        console.log(
            `  Per-entity extraction speedup: ${extractionSpeedup.toFixed(2)}x`
        )
        console.log(`  Total time speedup: ${totalSpeedup.toFixed(2)}x`)
        console.log(
            `  Time saved: ${(oldResult.totalTimeMs - newResult.totalTimeMs).toFixed(2)}ms`
        )

        // Compare values
        console.log("\n=== VALUE COMPARISON ===\n")
        const comparison = compareValues(oldResult.values, newResult.values)
        console.log(`  Entities with identical values: ${comparison.identical}`)
        console.log(`  Entities with different values: ${comparison.different}`)

        if (comparison.different > 0) {
            console.log("\n  First 10 differences:")
            for (const diff of comparison.differences.slice(0, 10)) {
                console.log(`    Entity: ${diff.entityName}`)
                console.log(`      Field: ${diff.field}`)
                console.log(`      Old: ${JSON.stringify(diff.oldValue)}`)
                console.log(`      New: ${JSON.stringify(diff.newValue)}`)
            }
            if (comparison.differences.length > 10) {
                console.log(
                    `    ... and ${comparison.differences.length - 10} more differences`
                )
            }
        } else {
            console.log("\n  All values are identical between methods!")
        }
    })
}

main()
    .catch((error) => {
        console.error("Error running benchmark:", error)
        process.exit(1)
    })
    .finally(async () => {
        process.exit(0)
    })
