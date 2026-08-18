import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { TagsTableName, VariablesTableName } from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"

const env = getAdminTestEnv()

const datasetPath = "grapher/ns/2026-01-01/ds"
const indicatorPath = `${datasetPath}/tb#new_indicator`
const otherPath = `${datasetPath}/tb#other_indicator`
const entityId = 987654

function indicator(overrides: Record<string, any> = {}): any {
    return {
        catalogPath: indicatorPath,
        shortName: "new_indicator",
        name: "New indicator",
        unit: "kg",
        shortUnit: "kg",
        coverage: "",
        timespan: "2000-2020",
        type: "float",
        display: { unit: "kg" },
        descriptionKey: "- First point\n- Second point",
        dataChecksum: "data-v1",
        origins: [
            {
                title: "Some data product",
                producer: "Some producer",
                citationFull: "Some producer (2026)",
                urlMain: "https://example.org",
                license: { name: "CC BY 4.0", url: "https://example.org/terms" },
            },
        ],
        topicTags: [],
        faqs: [],
        entityIds: [entityId],
        years: [2000, 2020],
        ...overrides,
    }
}

async function declare(indicators: string[], extra: object = {}): Promise<any> {
    return await env.request({
        method: "PUT",
        path: `/datasets/by-catalog-path/${encodeURIComponent(datasetPath)}`,
        body: JSON.stringify({
            name: "Dummy dataset",
            namespace: "owid",
            version: "2026-01-01",
            indicators,
            ...extra,
        }),
    })
}

async function putIndicators(indicators: any[]): Promise<any> {
    return await env.request({
        method: "PUT",
        path: `/datasets/by-catalog-path/${encodeURIComponent(datasetPath)}/indicators`,
        body: JSON.stringify({ indicators }),
    })
}

async function putChecksum(
    sourceChecksum: string,
    publishedData: Record<string, string>
): Promise<any> {
    return await env.request({
        method: "PUT",
        path: `/datasets/by-catalog-path/${encodeURIComponent(datasetPath)}/checksum`,
        body: JSON.stringify({ sourceChecksum, publishedData }),
    })
}

async function variableRow(catalogPath: string): Promise<any> {
    return await env.testKnex(VariablesTableName).where({ catalogPath }).first()
}

describe("Dataset publishing API", { timeout: 20000 }, () => {
    beforeEach(async () => {
        await env
            .testKnex("entities")
            .insert({
                id: entityId,
                name: "France",
                code: "FRA",
                validated: true,
            })
            .onConflict("id")
            .ignore()
    })

    it("creates the dataset on first declaration", async () => {
        const response = await declare([indicatorPath])

        expect(response.removed).toEqual([])
        expect(response.blocked).toEqual([])
        const dataset = await env
            .testKnex("datasets")
            .where({ catalogPath: datasetPath })
            .first()
        expect(dataset.name).toBe("Dummy dataset")
    })

    it("upserts an indicator and reports where its data goes", async () => {
        await declare([indicatorPath])
        const { indicators } = await putIndicators([indicator()])

        expect(indicators[indicatorPath].uploadData).toBe(true)
        expect(indicators[indicatorPath].dataPath).toContain(".data.json")
        // ETL is handed a location, never an id to reason about.
        expect(indicators[indicatorPath]).not.toHaveProperty("id")

        const row = await variableRow(indicatorPath)
        expect(row.name).toBe("New indicator")
        expect(row.type).toBe("float")
        // The metadata checksum is written here; the data checksum is not — nothing has
        // uploaded the values yet.
        expect(row.metadataChecksum).toBeTruthy()
        expect(row.dataChecksum).toBeNull()
    })

    it("only asks for a data upload when the values changed", async () => {
        await declare([indicatorPath])
        await putIndicators([indicator()])
        await putChecksum("src-1", { [indicatorPath]: "data-v1" })

        const unchanged = await putIndicators([indicator()])
        expect(unchanged.indicators[indicatorPath].uploadData).toBe(false)

        const changed = await putIndicators([
            indicator({ dataChecksum: "data-v2" }),
        ])
        expect(changed.indicators[indicatorPath].uploadData).toBe(true)
    })

    it("leaves the metadata checksum alone when nothing about it changed", async () => {
        await declare([indicatorPath])
        await putIndicators([indicator()])
        const first = await variableRow(indicatorPath)

        await putIndicators([indicator()])
        const second = await variableRow(indicatorPath)

        expect(second.metadataChecksum).toBe(first.metadataChecksum)
    })

    it("republishes when the metadata changed", async () => {
        await declare([indicatorPath])
        await putIndicators([indicator()])
        const before = await variableRow(indicatorPath)

        await putIndicators([indicator({ name: "Renamed indicator" })])
        const after = await variableRow(indicatorPath)

        expect(after.metadataChecksum).not.toBe(before.metadataChecksum)
        expect(after.id).toBe(before.id)
    })

    it("records data checksums only when told they were published", async () => {
        await declare([indicatorPath])
        await putIndicators([indicator()])
        expect((await variableRow(indicatorPath)).dataChecksum).toBeNull()

        await putChecksum("src-1", { [indicatorPath]: "data-v1" })

        expect((await variableRow(indicatorPath)).dataChecksum).toBe("data-v1")
        const dataset = await env
            .testKnex("datasets")
            .where({ catalogPath: datasetPath })
            .first()
        expect(dataset.sourceChecksum).toBe("src-1")
    })

    it("removes indicators left off the declaration", async () => {
        await declare([indicatorPath, otherPath])
        await putIndicators([
            indicator(),
            indicator({ catalogPath: otherPath, shortName: "other_indicator" }),
        ])

        const response = await declare([indicatorPath])

        expect(response.removed).toEqual([otherPath])
        expect(await variableRow(otherPath)).toBeUndefined()
        expect(await variableRow(indicatorPath)).toBeTruthy()
    })

    it("reports an indicator a chart still uses instead of removing it", async () => {
        await declare([indicatorPath, otherPath])
        await putIndicators([
            indicator(),
            indicator({ catalogPath: otherPath, shortName: "other_indicator" }),
        ])
        const otherId = (await variableRow(otherPath)).id

        const { chartId } = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "chart-using-it",
                title: "Chart using it",
                chartTypes: ["LineChart"],
                dimensions: [{ property: "y", variableId: otherId }],
            }),
        })

        const response = await declare([indicatorPath])

        expect(response.removed).toEqual([])
        expect(response.blocked).toEqual([
            {
                catalogPath: otherPath,
                charts: [{ id: chartId, slug: "chart-using-it" }],
            },
        ])
        expect(await variableRow(otherPath)).toBeTruthy()
    })

    it("refuses a declaration without an indicator list", async () => {
        const response = await fetch(
            `${env.baseUrl}/datasets/by-catalog-path/${encodeURIComponent(datasetPath)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${env.apiKey}`,
                },
                body: JSON.stringify({ name: "Dummy dataset" }),
            }
        )
        // Omitting it would read as "this dataset should contain nothing".
        expect(response.status).toBe(400)
    })

    it("links topic tags that exist and silently drops ones that don't", async () => {
        await env.testKnex(TagsTableName).insert({ id: 90, name: "Energy" })
        await declare([indicatorPath])

        await putIndicators([
            indicator({ topicTags: ["Energy", "Not A Real Tag"] }),
        ])

        expect(await env.getCount("tags_variables_topic_tags")).toBe(1)
    })

    it("reuses an existing origin instead of inserting a duplicate", async () => {
        await declare([indicatorPath, otherPath])
        await putIndicators([indicator()])
        const originCount = await env.getCount("origins")

        await putIndicators([
            indicator({ catalogPath: otherPath, shortName: "other_indicator" }),
        ])

        expect(await env.getCount("origins")).toBe(originCount)
    })
})
