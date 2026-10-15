import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { IndicatorsBeforePreProcessing, View } from "@ourworldindata/types"
import { knexReadonlyTransaction, TransactionCloseMode } from "../../db/db.js"
import { checkDatasetVariablesInUse } from "../../db/model/Dataset.js"
import { catalogPath, multiDimConfig, seedDataset } from "./fixtures.js"

const env = getAdminTestEnv()

describe(checkDatasetVariablesInUse, { timeout: 20000 }, () => {
    // The y and x ids share a prefix with the unused indicator, so a textual
    // match on `"id":1` would wrongly count them as uses of the unused dataset
    const unusedDatasetId = 1
    const unusedVariableId = 1
    const yDatasetId = 2
    const yVariableId = 13
    const xDatasetId = 3
    const xVariableId = 14

    async function multiDimCount(datasetId: number): Promise<number> {
        const { usageDetails } = await knexReadonlyTransaction(
            (trx) => checkDatasetVariablesInUse(trx, datasetId),
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
        return usageDetails.multiDimCount
    }

    beforeEach(async () => {
        await seedDataset(env, unusedDatasetId, [unusedVariableId])
        await seedDataset(env, yDatasetId, [yVariableId])
        await seedDataset(env, xDatasetId, [xVariableId])

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
