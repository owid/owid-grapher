/**
 * Simulate searches against our Algolia index and evaluate the results.
 */

import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { SEARCH_EVAL_URL } from "../../settings/serverSettings.js"
import { getIndexName } from "./searchClient.js"
import algoliasearch from "algoliasearch"

/* eslint-disable no-console */

// this many articles are displayed un-collapsed, only score this many results
const N_ARTICLES_DISPLAYED = 4

const CONCURRENT_QUERIES = 10

type QueryDataset = {
    name: string
    queries: Query[]
}

type Query = {
    query: string
    slugs: string[]
}

type ScoredQuery = {
    query: string
    expected: string[]
    actual: string[]
    precision: number
}

type SearchResults = {
    name: string
    scope: "articles" | "charts" | "all"
    meanPrecision: number
    numQueries: number
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
    const meanPrecision =
        results.map((r) => r.precision).reduce((a, b) => a + b) / results.length

    // print the results to two decimal places
    return {
        name: ds.name,
        scope: "articles",
        meanPrecision: parseFloat(meanPrecision.toFixed(3)),
        numQueries: ds.queries.length,
    }
}

const getClient = (): any => {
    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    return client
}

const fetchQueryDataset = async (name: string): Promise<QueryDataset> => {
    const url: string = `${SEARCH_EVAL_URL}/${name}`
    const resp = await fetch(url)
    const jsonData = await resp.json()
    return { name, queries: jsonData }
}

const simulateQuery = async (
    index: any,
    query: Query
): Promise<ScoredQuery> => {
    const { hits } = await index.search(query.query)
    const actual = hits.map((h: any) => h.slug)
    const precision = calculatePrecision(query.slugs, actual)
    return { query: query.query, expected: query.slugs, actual, precision }
}

const calculatePrecision = (expected: string[], actual: string[]): number => {
    const actualTruncated = actual.slice(0, N_ARTICLES_DISPLAYED)
    const n = actualTruncated.length
    if (n === 0) {
        return 0
    }
    const correct = actualTruncated.filter((a) => expected.includes(a)).length
    return correct / n
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

main()
