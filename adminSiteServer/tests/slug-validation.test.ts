import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ExplorersTableName,
    MultiDimDataPagesTableName,
} from "@ourworldindata/types"
import {
    knexReadonlyTransaction,
    TransactionCloseMode,
    validateChartSlug,
} from "../../db/db.js"
import { insertTestChart } from "../../db/tests/testHelpers.js"

const env = getAdminTestEnv()

describe(validateChartSlug, { timeout: 10000 }, () => {
    it("returns true for a valid grapher URL", async () => {
        // The slug lookup resolves through charts, so the config needs an
        // owning chart to be a valid grapher URL.
        await insertTestChart(env.testKnex, {
            config: { isPublished: true, slug: "life-expectancy" },
            lastEditedByUserId: env.userId,
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
        await env.testKnex(ExplorersTableName).insert({
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

        await env
            .testKnex(ExplorersTableName)
            .where({ slug: "migration" })
            .delete()
    })

    it("returns true for a valid multi-dim URL", async () => {
        await env.testKnex(MultiDimDataPagesTableName).insert({
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

        await env
            .testKnex(MultiDimDataPagesTableName)
            .where({ slug: "vaccination-coverage-who-unicef" })
            .delete()
    })
})
