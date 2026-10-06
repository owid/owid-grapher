import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartDimensionsTableName,
    DimensionProperty,
    GrapherInterface,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { v7 as uuidv7 } from "uuid"
import {
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

const env = getAdminTestEnv()

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

interface ChartSaveResponse {
    chartId: number
    created?: boolean
}

function saveChart(
    method: "POST" | "PUT",
    path: string,
    config: GrapherInterface
): Promise<ChartSaveResponse> {
    return env.request({ method, path, body: JSON.stringify(config) })
}

async function dimensionsByChart(): Promise<Record<number, number[]>> {
    const rows: { chartId: number; variableId: number }[] = await env
        .testKnex(ChartDimensionsTableName)
        .select("chartId", "variableId")
        .orderBy(["chartId", "order"])
    const variableIdsByChartId: Record<number, number[]> = {}
    for (const { chartId, variableId } of rows) {
        if (!variableIdsByChartId[chartId]) variableIdsByChartId[chartId] = []
        variableIdsByChartId[chartId].push(variableId)
    }
    return variableIdsByChartId
}

describe("Concurrent chart saves", { timeout: 30000 }, () => {
    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("creates adjacent charts concurrently without deadlocking", async () => {
        await Promise.all(
            Array.from({ length: CONCURRENT_SAVES }, (_, i) =>
                saveChart("POST", "/charts", chartConfig(i, [variableId]))
            )
        )

        const dimensions = await dimensionsByChart()
        expect(Object.keys(dimensions)).toHaveLength(CONCURRENT_SAVES)
        for (const chartDimensions of Object.values(dimensions))
            expect(chartDimensions).toEqual([variableId])
    })

    it("creates adjacent charts from ETL configs concurrently without deadlocking", async () => {
        const results = await Promise.all(
            Array.from({ length: CONCURRENT_SAVES }, (_, i) =>
                saveChart(
                    "PUT",
                    `/charts/by-config/${uuidv7()}/etlConfig`,
                    chartConfig(i, [variableId])
                )
            )
        )
        for (const result of results) expect(result.created).toBe(true)

        const dimensions = await dimensionsByChart()
        expect(Object.keys(dimensions)).toHaveLength(CONCURRENT_SAVES)
        for (const chartDimensions of Object.values(dimensions))
            expect(chartDimensions).toEqual([variableId])
    })

    it("updates adjacent charts concurrently without deadlocking", async () => {
        const chartIds: number[] = []
        for (let i = 0; i < CONCURRENT_SAVES; i++) {
            const { chartId } = await saveChart(
                "POST",
                "/charts",
                chartConfig(i, [variableId])
            )
            chartIds.push(chartId)
        }

        await Promise.all(
            chartIds.map((chartId, i) =>
                saveChart(
                    "PUT",
                    `/charts/${chartId}`,
                    chartConfig(i, [otherVariableId, variableId])
                )
            )
        )

        const dimensions = await dimensionsByChart()
        for (const chartId of chartIds)
            expect(dimensions[chartId]).toEqual([otherVariableId, variableId])
    })

    it("adds the first dimensions to adjacent charts concurrently without deadlocking", async () => {
        const chartIds: number[] = []
        for (let i = 0; i < CONCURRENT_SAVES; i++) {
            const { chartId } = await saveChart(
                "POST",
                "/charts",
                chartConfig(i, [])
            )
            chartIds.push(chartId)
        }

        await Promise.all(
            chartIds.map((chartId, i) =>
                saveChart(
                    "PUT",
                    `/charts/${chartId}`,
                    chartConfig(i, [variableId])
                )
            )
        )

        const dimensions = await dimensionsByChart()
        for (const chartId of chartIds)
            expect(dimensions[chartId]).toEqual([variableId])
    })

    it.each([
        { initialDimensions: "some", initialVariableIds: [variableId] },
        { initialDimensions: "no", initialVariableIds: [] },
    ])(
        "keeps one consistent set of dimensions when the same chart with $initialDimensions dimensions is saved concurrently",
        async ({ initialVariableIds }) => {
            const { chartId } = await saveChart(
                "POST",
                "/charts",
                chartConfig(0, initialVariableIds)
            )

            const variants = [[otherVariableId], [variableId, otherVariableId]]
            await Promise.all(
                Array.from({ length: CONCURRENT_SAVES }, (_, i) =>
                    saveChart(
                        "PUT",
                        `/charts/${chartId}`,
                        chartConfig(0, variants[i % variants.length])
                    )
                )
            )

            const config = await env.fetchJson(`/charts/${chartId}.config.json`)
            const dimensions = await dimensionsByChart()
            expect(dimensions[chartId]).toEqual(
                config.dimensions.map(
                    (dim: { variableId: number }) => dim.variableId
                )
            )
        }
    )

    it("replaces the dimension rows when a chart's dimensions shrink or are removed", async () => {
        const { chartId } = await saveChart(
            "POST",
            "/charts",
            chartConfig(0, [variableId, otherVariableId])
        )

        await saveChart(
            "PUT",
            `/charts/${chartId}`,
            chartConfig(0, [otherVariableId])
        )
        expect((await dimensionsByChart())[chartId]).toEqual([otherVariableId])

        await saveChart("PUT", `/charts/${chartId}`, chartConfig(0, []))
        expect((await dimensionsByChart())[chartId]).toBeUndefined()
    })
})
