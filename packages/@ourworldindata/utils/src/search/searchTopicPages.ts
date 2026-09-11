import {
    OwidGdocType,
    SearchFacetFilters,
    TagGraphNode,
    TagGraphRoot,
} from "@ourworldindata/types"
import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"
import { formatDisjunctiveFacetFilters } from "./searchFacetFilters.js"
import { searchSingleForHits } from "./searchClosestMatches.js"

// Shared between the site's search page (site/search/queries.ts) and the
// public /api/search Cloudflare function (functions/api/search/searchApi.ts)
// so both recommend the same topic pages for a query.

export const TOPIC_PAGE_TYPES: readonly OwidGdocType[] = [
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
]

export function isTopicPageType(type: string): boolean {
    return (TOPIC_PAGE_TYPES as readonly string[]).includes(type)
}

/**
 * How many of the best-ranked chart hits vote for the topics to recommend:
 * roughly the first few pages of chart results, i.e. the charts a searcher
 * would actually look at.
 */
export const TOPIC_VOTING_CHART_HITS = 50

/**
 * Ranks the topics behind a list of chart hits, best first. Each hit votes
 * for its topic tags with a weight that decays with its rank (reciprocal
 * rank), so the topics of the charts a searcher sees first win; a topic with
 * hundreds of poorly-ranked matches does not. Facet counts over every match
 * would do exactly that: "population" matches thousands of explorer views
 * about migration and natural disasters, which would outvote the Population
 * Growth charts ranked at the top.
 *
 * Only tags that are topics with a topic page count; areas are skipped even
 * though every chart carries one (they have no page of their own), and so
 * are searchable tags without a page.
 *
 * This is how search picks the topic pages to show for a query: charts
 * describe their subject in their titles ("GDP per capita"), while topic
 * pages are mostly charts and key indicators whose text isn't indexed, so a
 * full-text search over topic pages misses the very page a query is about
 * and surfaces pages that mention the term in passing instead.
 */
export function rankTopicsOfChartHits(
    hits: { tags?: string[] }[],
    tagGraph: TagGraphRoot
): { name: string; slug: string }[] {
    const areaNames = new Set(tagGraph.children.map((area) => area.name))
    const slugByTopicName = new Map<string, string>()
    const collectTopics = (node: TagGraphNode): void => {
        for (const child of node.children) {
            if (child.isTopic && child.slug && !areaNames.has(child.name))
                slugByTopicName.set(child.name, child.slug)
            collectTopics(child)
        }
    }
    collectTopics(tagGraph)

    // Map insertion order is first appearance, which breaks ties in favour
    // of the topic seen higher up.
    const scores = new Map<string, number>()
    hits.forEach((hit, rank) => {
        for (const tag of hit.tags ?? []) {
            if (!slugByTopicName.has(tag)) continue
            scores.set(tag, (scores.get(tag) ?? 0) + 1 / (rank + 1))
        }
    })

    return [...scores.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([name]) => ({ name, slug: slugByTopicName.get(name)! }))
}

/**
 * The topic pages behind the charts matching a query, most common topic
 * first, or undefined when no chart matches (callers fall back to a text
 * search over the topic pages themselves). `chartsFacetFilters` are the
 * filters of the chart search proper, so country and topic filters carry over.
 */
export async function searchTopicPagesOfMatchingCharts<
    THit extends { slug: string },
>(
    liteSearchClient: LiteClient,
    params: {
        chartsIndexName: string
        pagesIndexName: string
        query: string
        chartsFacetFilters: SearchFacetFilters
        tagGraph: TagGraphRoot
        /** Which topic page types to return; defaults to all of them. */
        pageTypes?: readonly OwidGdocType[]
        attributesToRetrieve: string[]
        offset: number
        length: number
    }
): Promise<SearchResponse<THit> | undefined> {
    const searchCharts = (
        queryType: "prefixNone" | "prefixLast"
    ): Promise<SearchResponse<{ tags?: string[] }>> =>
        searchSingleForHits<{ tags?: string[] }>(liteSearchClient, {
            indexName: params.chartsIndexName,
            query: params.query,
            facetFilters: params.chartsFacetFilters,
            attributesToRetrieve: ["tags"],
            hitsPerPage: TOPIC_VOTING_CHART_HITS,
            queryType,
        })

    // The words of a submitted search are whole words: "ai" means AI, not
    // the beginning of "air" or "aid". Algolia's default (prefixLast) treats
    // the last word as a prefix, which lets the many charts about air
    // pollution and foreign aid outvote the AI charts. So match whole words
    // first (Algolia's synonyms, e.g. ai → artificial intelligence, still
    // apply) and only fall back to prefix matching when that finds nothing,
    // i.e. when the word really is unfinished ("popul").
    let chartsResponse = await searchCharts("prefixNone")
    if (chartsResponse.hits.length === 0)
        chartsResponse = await searchCharts("prefixLast")
    const topics = rankTopicsOfChartHits(chartsResponse.hits, params.tagGraph)
    if (topics.length === 0) return undefined

    // The topic list is short (a few dozen at most), so fetch every page in
    // one request and paginate locally. Algolia returns them in its own
    // order; the facet order is what we want.
    const pageTypes = params.pageTypes ?? TOPIC_PAGE_TYPES
    const pagesResponse = await searchSingleForHits<THit>(liteSearchClient, {
        indexName: params.pagesIndexName,
        query: "",
        filters: pageTypes.map((type) => `type:${type}`).join(" OR "),
        facetFilters: formatDisjunctiveFacetFilters(
            new Set(topics.map((topic) => `/${topic.slug}`)),
            "path"
        ),
        attributesToRetrieve: params.attributesToRetrieve,
        hitsPerPage: topics.length,
    })
    const hitBySlug = new Map(pagesResponse.hits.map((hit) => [hit.slug, hit]))
    const orderedHits = topics.flatMap(
        (topic) => hitBySlug.get(topic.slug) ?? []
    )

    return {
        ...pagesResponse,
        hits: orderedHits.slice(params.offset, params.offset + params.length),
        nbHits: orderedHits.length,
        offset: params.offset,
        length: params.length,
    }
}
