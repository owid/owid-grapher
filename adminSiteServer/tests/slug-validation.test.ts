import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    ExplorersTableName,
    MultiDimDataPagesTableName,
} from "@ourworldindata/types"
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

    it("returns true for a valid explorer URL", async () => {
        await env.testKnex!(ExplorersTableName).insert({
            slug: "migration",
            config: {
                isPublished: true,
            },
            tsv: "isPublished\ttrue",
        })

        await knexReadonlyTransaction(
            async (trx) => {
                const { isValid } = await validateChartSlug(
                    trx,
                    "https://ourworldindata.org/explorers/migration"
                )
                expect(isValid).toBe(true)
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )

        await env.testKnex!(ExplorersTableName)
            .where({ slug: "migration" })
            .delete()
    })

    it("returns true for a valid multi-dim URL", async () => {
        await env.testKnex!(MultiDimDataPagesTableName).insert({
            slug: "vaccination-coverage-who-unicef",
            catalogPath:
                "grapher/vaccination_coverage/latest/vaccination_coverage",
            config: JSON.stringify({}),
            published: true,
        })

        await knexReadonlyTransaction(
            async (trx) => {
                const { isValid } = await validateChartSlug(
                    trx,
                    "https://ourworldindata.org/grapher/vaccination-coverage-who-unicef?metric=coverage&antigen=comparison"
                )
                expect(isValid).toBe(true)
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )

        await env.testKnex!(MultiDimDataPagesTableName)
            .where({ slug: "vaccination-coverage-who-unicef" })
            .delete()
    })
})
