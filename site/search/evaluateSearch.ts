/**
 * Simulate searches against our Algolia index and evaluate the results.
 */

import { fetchWithRetry } from "@ourworldindata/utils"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { SEARCH_EVAL_URL } from "../../settings/serverSettings.js"
import { getIndexName } from "./searchClient.js"
import algoliasearch from "algoliasearch"

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

type SearchResults = {
    name: string
    scope: "articles" | "charts" | "all"
    scores: Scores
    numQueries: number
    algoliaApp: string
    algoliaIndex: string
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
    const indexName = getIndexName("pages")

    // make a search client
    const client = getClient()
    const index = client.initIndex(indexName)

    // run the evaluation
    const results = await simulateQueries(index, ds.queries)
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
        algoliaApp: ALGOLIA_ID,
        algoliaIndex: indexName,
    }
}

const getClient = (): any => {
    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    return client
}

const fetchQueryDataset = async (name: string): Promise<QueryDataset> => {
    const url: string = `${SEARCH_EVAL_URL}/${name}`
    const resp = await fetchWithRetry(url)
    const jsonData = await resp.json()
    return { name, queries: jsonData }
}

const simulateQuery = async (
    index: any,
    query: Query
): Promise<ScoredQuery> => {
    const { hits } = await index.search(query.query)
    const actual = hits.map((h: any) => h.slug)
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
    index: any,
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
        const score = await simulateQuery(index, query)
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
