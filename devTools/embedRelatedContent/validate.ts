import * as path from "node:path"
import * as fs from "node:fs"
import * as db from "../../db/db.js"
import {
    getRelatedContentDetailed,
    PipelineDeps,
} from "../../db/model/RelatedContent/pipeline.js"
import {
    getCandidatePool,
    getSourcePage,
    getTagDocumentFrequency,
} from "../../db/model/RelatedContent/candidates.js"
import { DEFAULT_CONFIG } from "../../db/model/RelatedContent/config.js"
import { OverridesFile } from "../../db/model/RelatedContent/types.js"
import { BASE_DIR } from "../../settings/serverSettings.js"

const EXPERIMENT_CHART_IDS = [
    488, 230, 486, 5826, 373, 4659, 225, 297, 64, 586, 2028, 2994, 390, 319,
]

const OVERRIDES_PATH = path.join(BASE_DIR, "site/relatedContentOverrides.json")

const toPath = (urlOrPath: string): string => {
    try {
        return new URL(urlOrPath).pathname
    } catch {
        return urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`
    }
}

interface CheckResult {
    name: string
    pass: boolean
    detail?: string
}

const runChecks = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number,
    deps: PipelineDeps,
    overrides: OverridesFile
): Promise<{ slug: string; results: CheckResult[]; rawCount: number }> => {
    const source = await getSourcePage(knex, chartId)
    const items = await getRelatedContentDetailed(
        knex,
        chartId,
        DEFAULT_CONFIG,
        deps
    )
    const pool = await getCandidatePool(knex, source)
    const overrideEntry = overrides[source.slug] ?? {}
    const pinPaths = (overrideEntry.pins ?? []).map(toPath)
    const poolPaths = new Set(pool.map((c) => toPath(c.url)))
    const counts = items.reduce<Record<string, number>>((acc, it) => {
        acc[it.type] = (acc[it.type] || 0) + 1
        return acc
    }, {})

    const results: CheckResult[] = []

    const poolByType = pool.reduce<Record<string, number>>((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1
        return acc
    }, {})
    const quotaRespectingMax =
        Math.min(poolByType.grapher || 0, DEFAULT_CONFIG.quotas.maxGrapher) +
        Math.min(poolByType.article || 0, DEFAULT_CONFIG.quotas.maxArticle) +
        (poolByType["topic-page"] || 0) +
        (poolByType["data-insight"] || 0)
    const expected = Math.min(DEFAULT_CONFIG.listSize, quotaRespectingMax)
    results.push({
        name: "list size = min(10, quota-respecting pool max)",
        pass: items.length === expected,
        detail: `got ${items.length}, expected ${expected} (pool ${pool.length}, by-type ${JSON.stringify(poolByType)})`,
    })

    results.push({
        name: "source URL not in output",
        pass: !items.some((it) => toPath(it.url) === toPath(source.url)),
        detail: source.url,
    })

    results.push({
        name: "no duplicate URLs",
        pass: new Set(items.map((it) => it.url)).size === items.length,
    })

    results.push({
        name: "grapher count <= maxGrapher (4)",
        pass: (counts.grapher || 0) <= DEFAULT_CONFIG.quotas.maxGrapher,
        detail: `graphers=${counts.grapher || 0}`,
    })

    results.push({
        name: "article count <= maxArticle (6)",
        pass: (counts.article || 0) <= DEFAULT_CONFIG.quotas.maxArticle,
        detail: `articles=${counts.article || 0}`,
    })

    const poolHasTopic = pool.some((c) => c.type === "topic-page")
    results.push({
        name: "topic-page >= 1 (when pool has any)",
        pass:
            !poolHasTopic ||
            (counts["topic-page"] || 0) >= DEFAULT_CONFIG.quotas.minTopicPage,
        detail: poolHasTopic
            ? `topic-pages=${counts["topic-page"] || 0}`
            : "no topic-pages in pool",
    })

    const poolHasInsight = pool.some((c) => c.type === "data-insight")
    results.push({
        name: "data-insight >= 1 (when pool has any)",
        pass:
            !poolHasInsight ||
            (counts["data-insight"] || 0) >=
                DEFAULT_CONFIG.quotas.minDataInsight,
        detail: poolHasInsight
            ? `insights=${counts["data-insight"] || 0}`
            : "no data-insights in pool",
    })

    if (pinPaths.length > 0) {
        const itemPaths = items.map((it) => toPath(it.url))
        const expectedPinSequence = pinPaths.filter((p) => poolPaths.has(p))
        const actualPinSequence = itemPaths.slice(0, expectedPinSequence.length)
        results.push({
            name: "pinned items at top in declared order",
            pass:
                JSON.stringify(actualPinSequence) ===
                JSON.stringify(expectedPinSequence),
            detail: `expected=${JSON.stringify(expectedPinSequence)} actual=${JSON.stringify(actualPinSequence)}`,
        })
        const missingPins = pinPaths.filter((p) => !poolPaths.has(p))
        results.push({
            name: "all pins resolve in candidate pool",
            pass: missingPins.length === 0,
            detail:
                missingPins.length > 0
                    ? `missing: ${missingPins.join(", ")}`
                    : "all pins found",
        })
    } else {
        results.push({
            name: "pinned items at top in declared order",
            pass: true,
            detail: "no pins declared",
        })
        results.push({
            name: "all pins resolve in candidate pool",
            pass: true,
            detail: "no pins declared",
        })
    }

    const allSignalsValid = items.every((it) =>
        Object.values(it.signals).every(
            (v) => Number.isFinite(v) && v >= 0 && v <= 1
        )
    )
    results.push({
        name: "all signals in [0,1]",
        pass: allSignalsValid,
    })

    const allScoresValid = items.every(
        (it) => Number.isFinite(it.score) && it.score >= 0
    )
    results.push({
        name: "all scores finite and >= 0",
        pass: allScoresValid,
    })

    return { slug: source.slug, results, rawCount: items.length }
}

void (async () => {
    const overrides: OverridesFile = fs.existsSync(OVERRIDES_PATH)
        ? (JSON.parse(
              fs.readFileSync(OVERRIDES_PATH, "utf-8")
          ) as OverridesFile)
        : {}

    let totalChecks = 0
    let totalFailures = 0
    await db.knexReadonlyTransaction(async (knex) => {
        const stats = await getTagDocumentFrequency(knex)
        const deps: PipelineDeps = {
            tagDocFreq: stats.docFreq,
            totalDocsForIdf: stats.totalDocs,
        }

        for (const chartId of EXPERIMENT_CHART_IDS) {
            const { slug, results, rawCount } = await runChecks(
                knex,
                chartId,
                deps,
                overrides
            )
            const failed = results.filter((r) => !r.pass)
            totalChecks += results.length
            totalFailures += failed.length
            const status = failed.length === 0 ? "PASS" : "FAIL"
            console.log(
                `\n[${status}] chartId=${chartId} slug=${slug} (items=${rawCount})`
            )
            for (const r of results) {
                const mark = r.pass ? "  ok " : "  FAIL"
                const detail = r.detail ? ` — ${r.detail}` : ""
                console.log(`${mark}  ${r.name}${detail}`)
            }
        }
    }, db.TransactionCloseMode.Close)

    console.log(
        `\n=== Summary: ${totalChecks - totalFailures}/${totalChecks} checks passed across ${EXPERIMENT_CHART_IDS.length} chartIds ===`
    )
    if (totalFailures > 0) process.exitCode = 1
})()
