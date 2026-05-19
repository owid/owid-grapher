import * as db from "../../db/db.js"
import { getRelatedContentDetailed } from "../../db/model/RelatedContent/pipeline.js"
import { getTagDocumentFrequency } from "../../db/model/RelatedContent/candidates.js"

const IDS = [
    488, 230, 486, 5826, 373, 4659, 225, 297, 64, 586, 2028, 2994, 390, 319,
]

void (async () => {
    await db.knexReadonlyTransaction(async (knex) => {
        const t0 = Date.now()
        await getRelatedContentDetailed(knex, IDS[0])
        const cold = Date.now() - t0
        console.log(
            `Cold call (loads tagDocFreq + embeddings + queries): ${cold}ms`
        )

        const tStats = Date.now()
        const stats = await getTagDocumentFrequency(knex)
        console.log(`getTagDocumentFrequency alone: ${Date.now() - tStats}ms`)

        const deps = {
            tagDocFreq: stats.docFreq,
            totalDocsForIdf: stats.totalDocs,
        }

        const tWarm = Date.now()
        for (const id of IDS) {
            await getRelatedContentDetailed(knex, id, undefined, deps)
        }
        const warm = Date.now() - tWarm
        console.log(
            `${IDS.length} calls with shared tagDocFreq dep: ${warm}ms (${(warm / IDS.length).toFixed(1)}ms/call)`
        )

        const projected = ((warm / IDS.length) * 6000) / 1000
        console.log(
            `Projected cost for 6000 data pages at this per-call rate: ~${projected.toFixed(0)}s of pipeline time`
        )
    }, db.TransactionCloseMode.Close)
})()
