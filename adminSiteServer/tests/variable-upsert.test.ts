import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { TagsTableName, VariablesTableName } from "@ourworldindata/types"
import { datasetId, seedDatasetAndVariables } from "./fixtures.js"

const env = getAdminTestEnv()

const catalogPath = "grapher/ns/2026-01-01/ds/tb#new_indicator"
const entityId = 987654

function variableInput(overrides: Record<string, any> = {}): any {
    return {
        catalogPath,
        shortName: "new_indicator",
        name: "New indicator",
        unit: "kg",
        shortUnit: "kg",
        coverage: "",
        timespan: "2000-2020",
        type: "float",
        display: { unit: "kg" },
        descriptionKey: "- First point\n- Second point",
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

async function upsert(variables: any[]): Promise<any> {
    return await env.request({
        method: "POST",
        path: `/datasets/${datasetId}/variables`,
        body: JSON.stringify({ variables }),
    })
}

describe("Variable upsert", { timeout: 20000 }, () => {
    beforeEach(async () => {
        await seedDatasetAndVariables(env)
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

    it("creates a variable and returns its published metadata", async () => {
        const response = await upsert([variableInput()])
        const { id, metadata } = response.variables[catalogPath]

        expect(typeof id).toBe("number")
        expect(metadata.id).toBe(id)
        expect(metadata.name).toBe("New indicator")
        expect(metadata.type).toBe("float")
        expect(metadata.datasetId).toBe(datasetId)
        expect(metadata.descriptionKey).toBe("- First point\n- Second point")

        // Entity names and codes are resolved here, so ETL only sends ids.
        expect(metadata.dimensions.entities.values).toEqual([
            { id: entityId, name: "France", code: "FRA" },
        ])
        expect(metadata.dimensions.years.values).toEqual([
            { id: 2000 },
            { id: 2020 },
        ])

        expect(metadata.origins).toHaveLength(1)
        expect(metadata.origins[0].producer).toBe("Some producer")
        expect(metadata.origins[0].license).toEqual({
            name: "CC BY 4.0",
            url: "https://example.org/terms",
        })
        expect(typeof metadata.origins[0].id).toBe("number")
    })

    it("prunes nulls and empty values the way the published JSON always has", async () => {
        const { metadata } = (await upsert([variableInput()])).variables[
            catalogPath
        ]

        expect(metadata).not.toHaveProperty("descriptionShort")
        expect(metadata).not.toHaveProperty("presentation")
        expect(metadata).not.toHaveProperty("license")
    })

    it("updates an existing variable rather than creating a second one", async () => {
        const first = await upsert([variableInput()])
        const countAfterFirst = await env.getCount(VariablesTableName)

        const second = await upsert([variableInput({ name: "Renamed" })])

        expect(second.variables[catalogPath].id).toBe(
            first.variables[catalogPath].id
        )
        expect(await env.getCount(VariablesTableName)).toBe(countAfterFirst)
        expect(second.variables[catalogPath].metadata.name).toBe("Renamed")
    })

    it("reuses an existing origin instead of inserting a duplicate", async () => {
        await upsert([variableInput()])
        const originCount = await env.getCount("origins")

        await upsert([
            variableInput({
                catalogPath: `${catalogPath}_two`,
                shortName: "new_indicator_two",
            }),
        ])

        expect(await env.getCount("origins")).toBe(originCount)
    })

    it("links topic tags that exist and silently drops ones that don't", async () => {
        await env.testKnex(TagsTableName).insert({ id: 90, name: "Energy" })

        const { metadata } = (
            await upsert([
                variableInput({ topicTags: ["Energy", "Not A Real Tag"] }),
            ])
        ).variables[catalogPath]

        expect(metadata.presentation.topicTagsLinks).toEqual(["Energy"])
        expect(await env.getCount("tags_variables_topic_tags")).toBe(1)
    })

    it("puts the population origin last so data pages show it last", async () => {
        const population = {
            title: "Population",
            producer: "Various sources",
            citationFull: "Various sources",
        }
        const { metadata } = (
            await upsert([
                variableInput({
                    origins: [population, variableInput().origins[0]],
                }),
            ])
        ).variables[catalogPath]

        expect(metadata.origins.map((o: any) => o.producer)).toEqual([
            "Some producer",
            "Various sources",
        ])
    })

    it("rejects a variable without a type, which only ETL can infer", async () => {
        const response = await fetch(
            `${env.baseUrl}/datasets/${datasetId}/variables`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${env.apiKey}`,
                },
                body: JSON.stringify({
                    variables: [variableInput({ type: undefined })],
                }),
            }
        )
        expect(response.status).toBe(400)
    })
})
