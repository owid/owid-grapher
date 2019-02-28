import * as algoliasearch from 'algoliasearch'

import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY } from 'settings'

let algolia: algoliasearch.Client|undefined

function getClient() {
    if (!algolia)
        algolia = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    return algolia
}

export type PageHit = ArticleHit | CountryHit

export interface CountryHit {
    objectID: string,
    type: 'country',
    slug: string
    title: string
    code: string
    content: string
    _highlightResult: any
    _snippetResult: {
        content: {
            value: string
        }
    }
}

export interface ArticleHit {
    objectID: string,
    postId: number
    slug: string
    title: string
    type: 'post'|'page'
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
    pages: PageHit[]
    charts: ChartHit[]
}

export async function siteSearch(query: string): Promise<SiteSearchResults> {
    const json = await getClient().search([
        { indexName: 'pages', query: query, params: { distinct: true } },
        { indexName: 'charts', query: query, params: {} }
    ])
    
    return {
        pages: json.results[0].hits,
        charts: json.results[1].hits
    }
}