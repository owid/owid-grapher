import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartDimensionsTableName,
    DimensionProperty,
    GrapherInterface,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

const env = getAdminTestEnv()

// Saving a chart replaces its chart_dimensions rows. Charts created or edited
// at the same moment are neighbours in the chartId index, so a save that takes
// gap locks there deadlocks with its neighbour under REPEATABLE READ (the
// server's isolation level, which these tests keep).
const CONCURRENT_SAVES = 8

function chartConfig(i: number, variableIds: number[]): GrapherInterface {
    return {
        $schema: latestGrapherConfigSchema,
        slug: `concurrent-chart-${i}`,
        title: `Concurrent chart ${i}`,
        chartTypes: ["LineChart"],
        dimensions: variableIds.map((id) => ({
            variableId: id,
            property: DimensionProperty.y,
        })),
    }
}

async function saveChart(
    method: "POST" | "PUT",
    path: string,
    config: GrapherInterface
): Promise<{ status: number; body: any }> {
    const response = await fetch(env.baseUrl + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.apiKey}`,
        },
        body: JSON.stringify(config),
    })
    return { status: response.status, body: await response.json() }
}

async function dimensionsByChart(): Promise<Record<number, number[]>> {
    const rows = await env
        .testKnex(ChartDimensionsTableName)
        .select("chartId", "variableId")
        .orderBy(["chartId", "order"])
    const result: Record<number, number[]> = {}
    for (const row of rows)
        (result[row.chartId] ??= []).push(row.variableId as number)
    return result
}

describe("Concurrent chart saves", { timeout: 30000 }, () => {
    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("creates adjacent charts concurrently without deadlocking", async () => {
        const results = await Promise.all(
            Array.from({ length: CONCURRENT_SAVES }, (_, i) =>
                saveChart("POST", "/charts", chartConfig(i, [variableId]))
            )
        )
        for (const result of results) {
            expect(result.body.error).toBeUndefined()
            expect(result.status).toBe(200)
        }

        const dimensions = await dimensionsByChart()
        expect(Object.keys(dimensions)).toHaveLength(CONCURRENT_SAVES)
        for (const chartDimensions of Object.values(dimensions))
            expect(chartDimensions).toEqual([variableId])
    })

    it("updates adjacent charts concurrently without deadlocking", async () => {
        const chartIds: number[] = []
        for (let i = 0; i < CONCURRENT_SAVES; i++) {
            const { body } = await saveChart(
                "POST",
                "/charts",
                chartConfig(i, [variableId])
            )
            chartIds.push(body.chartId)
        }

        const results = await Promise.all(
            chartIds.map((chartId, i) =>
                saveChart(
                    "PUT",
                    `/charts/${chartId}`,
                    chartConfig(i, [otherVariableId, variableId])
                )
            )
        )
        for (const result of results) {
            expect(result.body.error).toBeUndefined()
            expect(result.status).toBe(200)
        }

        const dimensions = await dimensionsByChart()
        for (const chartId of chartIds)
            expect(dimensions[chartId]).toEqual([otherVariableId, variableId])
    })

    it("keeps one consistent set of dimensions when the same chart is saved concurrently", async () => {
        const { body } = await saveChart(
            "POST",
            "/charts",
            chartConfig(0, [variableId])
        )
        const chartId = body.chartId

        const variants = [[otherVariableId], [variableId, otherVariableId]]
        const results = await Promise.all(
            Array.from({ length: CONCURRENT_SAVES }, (_, i) =>
                saveChart(
                    "PUT",
                    `/charts/${chartId}`,
                    chartConfig(0, variants[i % variants.length])
                )
            )
        )
        for (const result of results) expect(result.status).toBe(200)

        // Whichever save committed last, the dimension rows must match the
        // stored config rather than mixing rows from several saves
        const config = await env.fetchJson(`/charts/${chartId}.config.json`)
        const dimensions = await dimensionsByChart()
        expect(dimensions[chartId]).toEqual(
            config.dimensions.map(
                (dim: { variableId: number }) => dim.variableId
            )
        )
    })
})
