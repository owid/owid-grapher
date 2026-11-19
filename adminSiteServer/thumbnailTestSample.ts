import {
    GrapherState,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import { GRAPHER_TAB_NAMES, GrapherInterface } from "@ourworldindata/types"
import * as db from "../db/db.js"
import {
    FACET_SECTION_ID,
    THUMBNAIL_TEST_SECTIONS,
    ThumbnailTestSection,
} from "./thumbnailTestCases.js"

interface SampleCandidate {
    slug: string
    title: string
    sectionId: string
    pageviews: number
}

let candidatesCache: SampleCandidate[] | undefined

/**
 * Picks published charts at random for each section, weighted by the log of
 * their yearly pageviews
 */
export async function sampleThumbnailTestSections(
    trx: db.KnexReadonlyTransaction,
    { countPerSection, seed }: { countPerSection: number; seed: number }
): Promise<ThumbnailTestSection[]> {
    candidatesCache ??= await findSampleCandidates(trx)
    const candidates = candidatesCache
    const random = makeSeededRandom(seed)
    return THUMBNAIL_TEST_SECTIONS.map((section) => ({
        ...section,
        cases: pickWeighted(
            candidates.filter((c) => c.sectionId === section.id),
            countPerSection,
            random
        ).map((candidate) => ({
            slug: candidate.slug,
            label: candidate.title,
        })),
    }))
}

async function findSampleCandidates(
    trx: db.KnexReadonlyTransaction
): Promise<SampleCandidate[]> {
    const rows = await db.knexRaw<{
        slug: string
        config: string
        pageviews: number | null
    }>(
        trx,
        `-- sql
        SELECT cc.slug, cc.config, p.views_365d AS pageviews
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        LEFT JOIN analytics_pageviews p
            ON p.url = CONCAT('https://ourworldindata.org/grapher/', cc.slug)
        WHERE cc.config ->> '$.isPublished' = 'true'
        ORDER BY cc.slug`
    )
    return rows.flatMap((row) => {
        const config: GrapherInterface = JSON.parse(row.config)
        const grapherState = new GrapherState(config)
        if (grapherState.activeTab === GRAPHER_TAB_NAMES.Table)
            grapherState.resetToDefaultTab()
        if (grapherState.activeTab === GRAPHER_TAB_NAMES.Table) return []
        const candidate = {
            slug: row.slug,
            title: config.title ?? row.slug,
            pageviews: row.pageviews ?? 0,
        }
        const tabSectionId = mapGrapherTabNameToQueryParam(
            grapherState.activeTab
        )
        const sectionIds = grapherState.isFaceted
            ? [tabSectionId, FACET_SECTION_ID]
            : [tabSectionId]
        return sectionIds.map((sectionId) => ({ ...candidate, sectionId }))
    })
}

/** Weighted sampling without replacement (Efraimidis–Spirakis) */
function pickWeighted(
    candidates: SampleCandidate[],
    count: number,
    random: () => number
): SampleCandidate[] {
    return candidates
        .map((candidate) => ({
            candidate,
            key: random() ** (1 / (1 + Math.log1p(candidate.pageviews))),
        }))
        .sort((a, b) => b.key - a.key)
        .slice(0, count)
        .map(({ candidate }) => candidate)
}

/** mulberry32 */
function makeSeededRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
