import * as algoliasearch from 'algoliasearch'

import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY } from 'settings'

interface SearchQuery {
    indexName: 'articles'|'charts'
    query: string
    params: algoliasearch.QueryParameters
}

let algolia: algoliasearch.Client|undefined

function getClient() {
    if (!algolia)
        algolia = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    return algolia
}

export interface PostHit {
    postId: number
    slug: string
    title: string
    postType: 'post'|'page'
    content: string
    excerpt: string
    _highlightResult: any
    _snippetResult: {
        content: {
            value: string
        }
    }
}

export interface ChartHit {
    chartId: number
    slug: string
    title: string
    subtitle: string
    variantName: string
    _highlightResult: any
    _snippetResult: {
        subtitle: {
            value: string
        }
    }
}

export interface SiteSearchResults {
    posts: PostHit[]
    charts: ChartHit[]
}

export async function siteSearch(query: string): Promise<SiteSearchResults> {
    const json = await getClient().search([
        { indexName: 'pages', query: query, params: { distinct: true } },
        { indexName: 'charts', query: query, params: {} }
    ])
    
    return {
        posts: json.results[0].hits,
        charts: json.results[1].hits
    }
}