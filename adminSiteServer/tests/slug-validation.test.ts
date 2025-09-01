import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { ChartConfigsTableName } from "@ourworldindata/types"
import {
    knexReadonlyTransaction,
    TransactionCloseMode,
    validateChartSlug,
} from "../../db/db.js"

const env = getAdminTestEnv()

describe("validateChartSlug", { timeout: 10000 }, () => {
    it("returns true for a valid grapher URL", async () => {
        await env.testKnex!(ChartConfigsTableName).insert({
            id: "0191b6c7-3629-74fd-9ebc-abcf9a99c1d2",
            patch: {},
            full: { isPublished: true, slug: "life-expectancy" },
        })

        await knexReadonlyTransaction(
            async (trx) => {
                const { isValid } = await validateChartSlug(
                    trx,
                    "https://ourworldindata.org/grapher/life-expectancy"
                )
                expect(isValid).toBe(true)
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )
    })
})
