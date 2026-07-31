/**
 * Simulate searches against our Typesense pages collection and evaluate the
 * results.
 */

import { fetchWithRetry } from "@ourworldindata/utils"
import {
    TYPESENSE_HOST,
    TYPESENSE_PORT,
    TYPESENSE_PROTOCOL,
    TYPESENSE_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { SEARCH_EVAL_URL } from "../../settings/serverSettings.js"
import { PAGES_INDEX, HYBRID_SEARCH_ALPHA } from "./searchUtils.js"
import Typesense, { Client } from "typesense"
import { PageRecord } from "@ourworldindata/types"

/* eslint-disable no-console */

// this many articles are displayed un-collapsed, only score this many results
const N_ARTICLES_QUICK_RESULTS = 2
const N_ARTICLES_LONG_RESULTS = 4

const CONCURRENT_QUERIES = 10

type QueryDataset = {
    name: string
    queries: Query[]
}

type Scores = { [key: string]: number }

type Query = {
    query: string
    slugs: string[]
}

type ScoredQuery = {
    query: string
    expected: string[]
    actual: string[]
    scores: Scores
}

type SearchEvaluationHit = Pick<PageRecord, "slug">

type SearchResults = {
    name: string
    scope: "articles" | "charts" | "all"
    scores: Scores
    numQueries: number
    typesenseHost: string
    typesenseIndex: string
}

const QUERY_FILES = {
    single: "synthetic-queries-single-2024-03-25.json",
    multi: "synthetic-queries-2024-03-25.json",
}

const main = async (): Promise<void> => {
    // only do the multi, since it contains the single-word set as well
    await evaluateAndPrint(QUERY_FILES.multi)
}

const evaluateAndPrint = async (name: string): Promise<void> => {
    const results = await evaluateArticleSearch(name)
    console.log(JSON.stringify(results, null, 2))
}

const evaluateArticleSearch = async (name: string): Promise<SearchResults> => {
    const ds = await fetchQueryDataset(name)
    const indexName = PAGES_INDEX

    // make a search client
    const client = new Typesense.Client({
        apiKey: TYPESENSE_SEARCH_KEY,
        nodes: [
            {
                host: TYPESENSE_HOST,
                port: TYPESENSE_PORT,
                protocol: TYPESENSE_PROTOCOL,
            },
        ],
    })

    // run the evaluation
    const results = await simulateQueries(client, indexName, ds.queries)
    const scores: Scores = {}
    for (const scoreName of Object.keys(results[0].scores)) {
        const mean =
            results.map((r) => r.scores[scoreName]).reduce((a, b) => a + b) /
            results.length
        scores[scoreName] = parseFloat(mean.toFixed(3))
    }

    // print the results to two decimal places
    return {
        name: ds.name,
        scope: "articles",
        scores: scores,
        numQueries: ds.queries.length,
        typesenseHost: TYPESENSE_HOST,
        typesenseIndex: indexName,
    }
}

const fetchQueryDataset = async (name: string): Promise<QueryDataset> => {
    const url: string = `${SEARCH_EVAL_URL}/${name}`
    const resp = await fetchWithRetry(url)
    const jsonData = await resp.json()
    return { name, queries: jsonData }
}

const simulateQuery = async (
    searchClient: Client,
    indexName: string,
    query: Query
): Promise<ScoredQuery> => {
    // Mirror the production article search (queryArticles in queries.ts):
    // hybrid keyword + vector search with slug dedup across content chunks.
    const response = await searchClient
        .collections<SearchEvaluationHit>(indexName)
        .documents()
        .search({
            q: query.query,
            query_by: "embedding,title,excerpt,tags,authors,content",
            vector_query: `embedding:([], k:100, alpha:${HYBRID_SEARCH_ALPHA})`,
            prefix: false,
            stopwords: "english",
            group_by: "slug",
            group_limit: 1,
            per_page: 10,
            page: 1,
        })
    const rawHits =
        response.hits ??
        response.grouped_hits?.flatMap((group) => group.hits ?? []) ??
        []
    const actual = rawHits.map((hit) => hit.document.slug)
    const scores = scoreResults(query.slugs, actual)
    return { query: query.query, expected: query.slugs, actual, scores }
}

const scoreResults = (relevant: string[], actual: string[]): Scores => {
    const scores: Scores = {}

    for (const k of [N_ARTICLES_QUICK_RESULTS, N_ARTICLES_LONG_RESULTS]) {
        const key = `precision@${k}`
        const actualTruncated = actual.slice(0, k)
        const n = actualTruncated.length
        if (n === 0) {
            scores[key] = 0
            continue
        }

        const correct = actualTruncated.filter((a) =>
            relevant.includes(a)
        ).length
        scores[key] = correct / n
    }
    return scores
}

const simulateQueries = async (
    searchClient: Client,
    indexName: string,
    queries: Query[]
): Promise<ScoredQuery[]> => {
    // NOTE: should be a rate-limited version of:
    //
    // const scores = await Promise.all(
    //     queries.map((query) => simulateQuery(index, query))
    // )

    let activeQueries = 0
    let i = 0
    const scores: ScoredQuery[] = []

    const next = async () => {
        if (i >= queries.length) return
        const query = queries[i++]
        activeQueries++
        const score = await simulateQuery(searchClient, indexName, query)
        scores.push(score)
        activeQueries--
        if (i < queries.length) {
            await next()
        }
    }

    const promises = []
    while (activeQueries < CONCURRENT_QUERIES && i < queries.length) {
        promises.push(next())
    }

    await Promise.all(promises)

    return scores
}

void main()
