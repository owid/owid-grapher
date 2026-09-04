import {
    OwidGdocType,
    SearchFacetFilters,
    TagGraphNode,
    TagGraphRoot,
} from "@ourworldindata/types"
import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"
import {
    formatDisjunctiveFacetFilters,
    MAX_FACET_VALUES,
} from "./searchFacetFilters.js"
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
 * Ranks the topics behind a set of chart results, most common first, given the
 * charts index's `tags` facet counts for a query. Only tags that are topics
 * with a topic page count; areas are skipped even though they carry the
 * highest counts by construction (every chart in a topic is also in its
 * area), because an area has no page of its own to recommend.
 *
 * This is how search picks the topic pages to show for a query: charts
 * describe their subject in their titles ("GDP per capita"), while topic
 * pages are mostly charts and key indicators whose text isn't indexed, so a
 * full-text search over topic pages misses the very page a query is about
 * and surfaces pages that mention the term in passing instead.
 */
export function rankTopicsByChartTagCounts(
    tagCounts: Record<string, number>,
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

    return Object.entries(tagCounts)
        .filter(([name]) => slugByTopicName.has(name))
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
    const chartsResponse = await searchSingleForHits<unknown>(
        liteSearchClient,
        {
            indexName: params.chartsIndexName,
            query: params.query,
            facetFilters: params.chartsFacetFilters,
            facets: ["tags"],
            maxValuesPerFacet: MAX_FACET_VALUES,
            hitsPerPage: 0,
        }
    )
    const topics = rankTopicsByChartTagCounts(
        chartsResponse.facets?.tags ?? {},
        params.tagGraph
    )
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
