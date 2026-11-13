import { liteClient, type LiteClient } from "algoliasearch/lite"
import { createNullCache } from "@algolia/client-common"
import { createFetchRequester } from "@algolia/requester-fetch"
import { SearchIndexName } from "@ourworldindata/types"
import type { SearchIndexNames } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"

export interface AlgoliaConfig {
    appId: string
    apiKey: string
    indexPrefix?: string
    /**
     * The reader's IP, forwarded to Algolia so its analytics tell readers
     * apart (and attribute countries) as when the browser queries it directly
     */
    readerIp?: string
    /** DIAGNOSTIC: every Algolia attempt this request made */
    attempts?: AlgoliaAttempt[]
}

export interface AlgoliaAttempt {
    host: string
    ms: number
    status: number
    timedOut: boolean
    serverMs?: number
    processingMs?: number
}

export function getAlgoliaConfig(env: Env, request?: Request): AlgoliaConfig {
    const appId = env.ALGOLIA_ID
    const apiKey = env.ALGOLIA_SEARCH_KEY

    if (!appId || !apiKey) {
        throw new Error("Missing ALGOLIA_ID or ALGOLIA_SEARCH_KEY")
    }

    return {
        appId,
        apiKey,
        indexPrefix: env.ALGOLIA_INDEX_PREFIX,
        readerIp: request?.headers.get("CF-Connecting-IP") ?? undefined,
    }
}

export function getIndexName(
    index: string,
    indexPrefix: string | undefined
): string {
    if (indexPrefix && indexPrefix !== "") {
        return `${indexPrefix}-${index}`
    }
    return index
}

/** The chart and page indices the search page queries. */
export function getSearchIndexNames(
    indexPrefix: string | undefined
): SearchIndexNames {
    return {
        charts: getIndexName(
            SearchIndexName.ExplorerViewsMdimViewsAndCharts,
            indexPrefix
        ),
        pages: getIndexName(SearchIndexName.Pages, indexPrefix),
    }
}

// The same algoliasearch client the site uses. It needs an explicit fetch()
// requester here because its default requester selection (XHR in browsers,
// http.Agent in Node) has no automatic Cloudflare Workers case.
//
// We disable the cache here because we don't need it with a single search per
// request, which also makes the client safe to hoist to module scope.
export function createSearchClient(config: AlgoliaConfig): LiteClient {
    const fetchRequester = createFetchRequester()
    const { readerIp, attempts } = config
    return liteClient(config.appId, config.apiKey, {
        requester: {
            send: async (request) => {
                const t0 = Date.now()
                const response = await fetchRequester.send({
                    ...request,
                    headers: readerIp
                        ? { ...request.headers, "X-Forwarded-For": readerIp }
                        : request.headers,
                })
                const ms = Date.now() - t0
                let serverMs: number | undefined
                let processingMs: number | undefined
                try {
                    const body = JSON.parse(response.content) as {
                        results?: {
                            serverTimeMS?: number
                            processingTimeMS?: number
                        }[]
                        serverTimeMS?: number
                        processingTimeMS?: number
                    }
                    const first = body.results?.[0] ?? body
                    serverMs = first.serverTimeMS
                    processingMs = first.processingTimeMS
                } catch {
                    // Not JSON (a timeout or network error)
                }
                attempts?.push({
                    host: new URL(request.url).host,
                    ms,
                    status: response.status,
                    timedOut: response.isTimedOut,
                    serverMs,
                    processingMs,
                })
                return response
            },
        },
        responsesCache: createNullCache(),
    })
}
