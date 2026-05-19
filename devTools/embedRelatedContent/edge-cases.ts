import * as path from "node:path"
import * as fs from "node:fs"
import * as db from "../../db/db.js"
import { getRelatedContentDetailed } from "../../db/model/RelatedContent/pipeline.js"
import { OverridesFile } from "../../db/model/RelatedContent/types.js"

const TMP_OVERRIDES = "/tmp/overrides-test.json"

const writeOverrides = (data: OverridesFile): void => {
    fs.writeFileSync(TMP_OVERRIDES, JSON.stringify(data, null, 2))
}

const probe = async (label: string, fn: () => Promise<void>): Promise<void> => {
    console.log(`\n--- ${label} ---`)
    try {
        await fn()
    } catch (err) {
        console.log(`  CRASHED: ${(err as Error).message}`)
    }
}

void (async () => {
    await db.knexReadonlyTransaction(async (knex) => {
        await probe(
            "1. Empty embeddings cache → embedding signal = 0 everywhere",
            async () => {
                const items = await getRelatedContentDetailed(
                    knex,
                    225,
                    undefined,
                    {
                        embeddingsPath: "/tmp/does-not-exist.json",
                    }
                )
                const allZero = items.every((it) => it.signals.embedding === 0)
                console.log(
                    `  items=${items.length} allEmbeddingZero=${allZero}`
                )
            }
        )

        await probe(
            "2. Pin not in candidate pool → warning, list still works",
            async () => {
                writeOverrides({
                    "gdp-per-capita-worldbank": {
                        pins: [
                            "https://ourworldindata.org/this-does-not-exist",
                        ],
                        excludes: [],
                    },
                })
                const items = await getRelatedContentDetailed(
                    knex,
                    225,
                    undefined,
                    {
                        overridesPath: TMP_OVERRIDES,
                    }
                )
                console.log(
                    `  items=${items.length} firstType=${items[0]?.type} pinnedCount=${items.filter((i) => i.isPinned).length}`
                )
            }
        )

        await probe(
            "3. Pin also in excludes → exclude wins, warning fires",
            async () => {
                const url = "https://ourworldindata.org/economic-growth"
                writeOverrides({
                    "gdp-per-capita-worldbank": {
                        pins: [url],
                        excludes: [url],
                    },
                })
                const items = await getRelatedContentDetailed(
                    knex,
                    225,
                    undefined,
                    {
                        overridesPath: TMP_OVERRIDES,
                    }
                )
                const hasIt = items.some(
                    (it) => new URL(it.url).pathname === "/economic-growth"
                )
                console.log(
                    `  items=${items.length} includesExcludedPin=${hasIt}`
                )
            }
        )

        await probe("4. Override entry for unknown slug → no-op", async () => {
            writeOverrides({
                "totally-fake-slug": {
                    pins: ["https://ourworldindata.org/foo"],
                },
            })
            const items = await getRelatedContentDetailed(
                knex,
                225,
                undefined,
                {
                    overridesPath: TMP_OVERRIDES,
                }
            )
            console.log(`  items=${items.length} (should be 10)`)
        })

        await probe("5. Pure exclude → top item is removed", async () => {
            const baseItems = await getRelatedContentDetailed(
                knex,
                225,
                undefined,
                {
                    overridesPath: "/tmp/none.json",
                }
            )
            const topUrl = baseItems[0].url
            writeOverrides({
                "gdp-per-capita-worldbank": {
                    excludes: [topUrl],
                },
            })
            const items = await getRelatedContentDetailed(
                knex,
                225,
                undefined,
                {
                    overridesPath: TMP_OVERRIDES,
                }
            )
            const stillThere = items.some((it) => it.url === topUrl)
            console.log(`  excluded=${topUrl}\n  stillInOutput=${stillThere}`)
        })

        await probe(
            "6. Chart with no tags (zero-tag invented chartId)",
            async () => {
                const items = await getRelatedContentDetailed(knex, 999999999)
                console.log(`  items=${items.length}`)
            }
        )

        await probe(
            "7. Years-of-schooling key uses real slug (mean-years-of-schooling-long-run)",
            async () => {
                const overrides = JSON.parse(
                    fs.readFileSync(
                        path.join(
                            process.cwd(),
                            "site/relatedContentOverrides.json"
                        ),
                        "utf-8"
                    )
                )
                const has = "mean-years-of-schooling-long-run" in overrides
                const stale = "years-of-schooling" in overrides
                console.log(`  uses-canonical=${has} uses-stale-key=${stale}`)
            }
        )

        if (fs.existsSync(TMP_OVERRIDES)) fs.unlinkSync(TMP_OVERRIDES)
    }, db.TransactionCloseMode.Close)
})()
