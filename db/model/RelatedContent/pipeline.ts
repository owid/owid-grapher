import * as path from "node:path"
import * as db from "../../db.js"
import { BASE_DIR } from "../../../settings/serverSettings.js"
import {
    getCandidatePool,
    getSourcePage,
    getTagDocumentFrequency,
} from "./candidates.js"
import { scoreCandidates, ScoringContext } from "./scoring.js"
import { diversify } from "./diversify.js"
import { composeTopAndFill } from "./compose.js"
import {
    applyExcludes,
    buildPinOrderMap,
    loadOverrides,
    markPins,
    pinOrderKey,
} from "./overrides.js"
import { loadEmbeddingsCache } from "./embeddings.js"
import { DEFAULT_CONFIG, RelatedContentConfig } from "./config.js"
import { RelatedItem, ScoredCandidate } from "./types.js"

const EMBEDDINGS_PATH = path.join(BASE_DIR, "site/embeddingsCache.json")
const OVERRIDES_PATH = path.join(BASE_DIR, "site/relatedContentOverrides.json")

export interface PipelineDeps {
    embeddingsPath?: string
    overridesPath?: string
    tagDocFreq?: Map<number, number>
    totalDocsForIdf?: number
}

export const getRelatedContent = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number,
    config: RelatedContentConfig = DEFAULT_CONFIG,
    deps: PipelineDeps = {}
): Promise<RelatedItem[]> => {
    const result = await getRelatedContentDetailed(knex, chartId, config, deps)
    return result.map(({ url, title, type, isPinned }) => ({
        url,
        title,
        type,
        isPinned,
    }))
}

export const getRelatedContentDetailed = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number,
    config: RelatedContentConfig = DEFAULT_CONFIG,
    deps: PipelineDeps = {}
): Promise<ScoredCandidate[]> => {
    const source = await getSourcePage(knex, chartId)

    let docFreq = deps.tagDocFreq
    let totalDocs = deps.totalDocsForIdf
    if (!docFreq || totalDocs === undefined) {
        const stats = await getTagDocumentFrequency(knex)
        docFreq = stats.docFreq
        totalDocs = stats.totalDocs
    }

    const pool = await getCandidatePool(knex, source)

    const overrides = loadOverrides(deps.overridesPath ?? OVERRIDES_PATH)
    const overrideEntry = overrides[source.slug] ?? {}
    const filtered = applyExcludes(pool, overrideEntry.excludes)
    const marked = markPins(filtered, overrideEntry.pins)

    const embeddings = loadEmbeddingsCache(
        deps.embeddingsPath ?? EMBEDDINGS_PATH
    )
    const ctx: ScoringContext = {
        tagDocFreq: docFreq,
        totalDocsForIdf: totalDocs,
        embeddings,
    }

    const scored = scoreCandidates(marked, source, ctx, config)

    // Index pins once so the sort compare is O(1) per pair rather than
    // re-walking the pins array for every comparison.
    const pinOrder = buildPinOrderMap(overrideEntry.pins)
    const stable = scored.sort((a, b) => {
        if (a.isPinned && b.isPinned) {
            return (
                (pinOrder.get(pinOrderKey(a.url)) ?? 0) -
                (pinOrder.get(pinOrderKey(b.url)) ?? 0)
            )
        }
        if (a.isPinned) return -1
        if (b.isPinned) return 1
        return b.score - a.score
    })

    const diversified = diversify(
        stable.slice(0, config.candidatePoolSize),
        config
    )
    return composeTopAndFill(diversified, config)
}
