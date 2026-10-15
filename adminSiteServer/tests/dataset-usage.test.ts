import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    DatasetsTableName,
    IndicatorsBeforePreProcessing,
    VariablesTableName,
    View,
} from "@ourworldindata/types"
import { knexReadonlyTransaction, TransactionCloseMode } from "../../db/db.js"
import { checkDatasetVariablesInUse } from "../../db/model/Dataset.js"
import { catalogPath, multiDimConfig } from "./fixtures.js"

const env = getAdminTestEnv()

describe(checkDatasetVariablesInUse, { timeout: 20000 }, () => {
    // Ids sharing a prefix with indicator 1, so a textual match on `"id":1`
    // would wrongly count them as uses of the unused dataset
    const unusedDatasetId = 1
    const yDatasetId = 2
    const yVariableId = 13
    const xDatasetId = 3
    const xVariableId = 24

    async function seedDatasetWithVariable(
        id: number,
        variableId: number
    ): Promise<void> {
        await env.testKnex(DatasetsTableName).insert({
            id,
            name: `Dataset ${id}`,
            description: "Dataset description",
            namespace: "owid",
            createdByUserId: env.userId,
            metadataEditedAt: new Date(),
            metadataEditedByUserId: env.userId,
            dataEditedAt: new Date(),
            dataEditedByUserId: env.userId,
        })
        await env.testKnex(VariablesTableName).insert({
            id: variableId,
            unit: "kg",
            coverage: "Global by country",
            timespan: "2000-2020",
            datasetId: id,
            display: '{ "unit": "kg", "shortUnit": "kg" }',
        })
    }

    async function multiDimCount(id: number): Promise<number> {
        const { usageDetails } = await knexReadonlyTransaction(
            (trx) => checkDatasetVariablesInUse(trx, id),
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
        return usageDetails.multiDimCount
    }

    beforeEach(async () => {
        await seedDatasetWithVariable(unusedDatasetId, 1)
        await seedDatasetWithVariable(yDatasetId, yVariableId)
        await seedDatasetWithVariable(xDatasetId, xVariableId)

        const view: View<IndicatorsBeforePreProcessing> = {
            config: {
                title: "GDP vs. energy use",
                chartTypes: ["ScatterPlot"],
            },
            dimensions: { metric: "total" },
            indicators: { y: yVariableId, x: xVariableId },
        }
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({ config: multiDimConfig([view]) }),
        })
    })

    it("counts a multi-dim page whose views plot the dataset on y", async () => {
        expect(await multiDimCount(yDatasetId)).toBe(1)
    })

    it("counts a multi-dim page that uses the dataset only on x", async () => {
        expect(await multiDimCount(xDatasetId)).toBe(1)
    })

    it("ignores indicators whose ids only share a prefix", async () => {
        expect(await multiDimCount(unusedDatasetId)).toBe(0)
    })
})
