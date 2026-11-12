import * as Sentry from "@sentry/cloudflare"
import { SearchIndexName } from "@ourworldindata/types"
import {
    SEARCH_PAGE_SECTIONS,
    searchPageSection,
    searchUrlParamsToSectionState,
    type SearchPageSection,
    type SearchPageSectionRequest,
    type SectionSearchState,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import { fetchTagGraph } from "../../_common/search/tagGraph.js"
import {
    createSearchClient,
    getAlgoliaConfig,
    getIndexName,
} from "./algoliaClient.js"

/**
 * One section of the search page's results, for the search page itself.
 *
 * The site sends each section's search here (see querySection in
 * site/search/queries.ts) when SEARCH_SECTIONS_URL is set, instead of
 * querying Algolia from the browser. This runs the same searchPageSection the
 * browser would, so the results are identical, and returns Algolia's response
 * as is: the search page renders its highlights and snippets.
 *
 * This is the search page's endpoint, not a public API: its response is
 * Algolia's, and it changes with the page. /api/search is the public one.
 *
 * Parameters: `section` (one of SEARCH_PAGE_SECTIONS), the search page's own
 * state parameters (`q`, `topics`, `countries`, `requireAllCountries`,
 * dataset filters), and the section's pagination: `page` for charts, `page`
 * and `hitsPerPage` for data insights, `offset` and `length` otherwise.
 */

// Algolia rejects queries longer than 512 bytes
const MAX_QUERY_LENGTH = 512
const MAX_FILTERS = 50
const MAX_FILTER_NAME_LENGTH = 200
const MAX_PAGE = 1000
const MAX_HITS_PER_PAGE = 100

const HEADERS = {
    "Content-Type": "application/json",
    // The page calls this cross-origin in local development
    "Access-Control-Allow-Origin": "*",
}

class InvalidRequestError extends Error {}

const isSection = (value: string | null): value is SearchPageSection =>
    (SEARCH_PAGE_SECTIONS as readonly (string | null)[]).includes(value)

function parseInteger(
    params: URLSearchParams,
    name: string,
    min: number,
    max: number
): number {
    const value = params.get(name)
    if (value === null || !/^\d+$/.test(value))
        throw new InvalidRequestError(`Missing or invalid "${name}"`)
    const number = Number(value)
    if (number < min || number > max)
        throw new InvalidRequestError(
            `"${name}" must be between ${min} and ${max}`
        )
    return number
}

function parseState(params: URLSearchParams): SectionSearchState {
    const state = searchUrlParamsToSectionState(params)
    if (new TextEncoder().encode(state.query).length > MAX_QUERY_LENGTH)
        throw new InvalidRequestError("Query too long")
    if (state.filters.length > MAX_FILTERS)
        throw new InvalidRequestError("Too many filters")
    if (state.filters.some((f) => f.name.length > MAX_FILTER_NAME_LENGTH))
        throw new InvalidRequestError("Filter value too long")
    return state
}

function parseSectionRequest(
    params: URLSearchParams
): SearchPageSectionRequest {
    const section = params.get("section")
    if (!isSection(section))
        throw new InvalidRequestError(
            `"section" must be one of: ${SEARCH_PAGE_SECTIONS.join(", ")}`
        )
    const state = parseState(params)
    switch (section) {
        case "charts":
            return {
                section,
                state,
                page: parseInteger(params, "page", 0, MAX_PAGE),
            }
        case "data-insights":
            return {
                section,
                state,
                page: parseInteger(params, "page", 0, MAX_PAGE),
                hitsPerPage: parseInteger(
                    params,
                    "hitsPerPage",
                    1,
                    MAX_HITS_PER_PAGE
                ),
            }
        case "articles":
        case "topic-pages":
        case "profiles":
            return {
                section,
                state,
                offset: parseInteger(
                    params,
                    "offset",
                    0,
                    MAX_PAGE * MAX_HITS_PER_PAGE
                ),
                length: parseInteger(params, "length", 1, MAX_HITS_PER_PAGE),
            }
    }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    let sectionRequest: SearchPageSectionRequest
    try {
        sectionRequest = parseSectionRequest(url.searchParams)
    } catch (error) {
        if (!(error instanceof InvalidRequestError)) throw error
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: HEADERS,
        })
    }

    try {
        const config = getAlgoliaConfig(env)
        const baseUrl = `${url.protocol}//${url.host}`
        const result = await searchPageSection(
            createSearchClient(config),
            sectionRequest,
            {
                indexNames: {
                    charts: getIndexName(
                        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
                        config.indexPrefix
                    ),
                    pages: getIndexName(
                        SearchIndexName.Pages,
                        config.indexPrefix
                    ),
                },
                loadTagGraph: () => fetchTagGraph(env, baseUrl),
            }
        )
        return new Response(JSON.stringify(result), {
            headers: {
                ...HEADERS,
                // As long as /api/search's responses
                "Cache-Control": "public, max-age=600",
            },
        })
    } catch (error) {
        console.error("Search sections error:", error)
        Sentry.captureException(error)
        return new Response(
            JSON.stringify({
                error: "An error occurred while processing the search request",
            }),
            { status: 500, headers: HEADERS }
        )
    }
}
