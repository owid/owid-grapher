import * as db from "../../db/db.js"
import { getRelatedContentDetailed } from "../../db/model/RelatedContent/pipeline.js"

const SAMPLE_IDS: { id: number; slug: string }[] = [
    { id: 225, slug: "gdp-per-capita-worldbank" },
    { id: 64, slug: "life-expectancy" },
    { id: 488, slug: "annual-co2-emissions-per-country" },
    { id: 5826, slug: "democracy-index-eiu" },
]

void (async () => {
    await db.knexReadonlyTransaction(async (knex) => {
        for (const { id, slug } of SAMPLE_IDS) {
            console.log(`\n=== ${slug} (chartId=${id}) ===`)
            const items = await getRelatedContentDetailed(knex, id)
            for (const item of items) {
                const pin = item.isPinned ? " [PIN]" : ""
                const sig = `tag=${item.signals.tagIdf.toFixed(2)} var=${item.signals.varOverlap.toFixed(2)} emb=${item.signals.embedding.toFixed(2)} q=${item.signals.quality.toFixed(2)} r=${item.signals.recency.toFixed(2)}`
                console.log(
                    `  [${item.type.padEnd(13)}] ${item.score.toFixed(3)}${pin}  ${item.title.slice(0, 80)}`
                )
                console.log(`      ${sig}`)
                console.log(`      ${item.url}`)
            }
        }
    }, db.TransactionCloseMode.Close)
})()
