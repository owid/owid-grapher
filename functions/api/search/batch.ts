import { Env } from "../../_common/env.js"
import {
    SEARCH_BATCH_MAX_REQUESTS,
    SEARCH_BATCH_PARAM,
    type SearchApiBatchResponse,
} from "@ourworldindata/utils"
import { handleSearchRequest } from "./index.js"

const json = (body: unknown, status: number, cacheControl: string): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": cacheControl,
            "Access-Control-Allow-Origin": "*",
        },
    })

const maxAgeOf = (response: Response): number =>
    Number(
        /max-age=(\d+)/.exec(
            response.headers.get("Cache-Control") ?? ""
        )?.[1] ?? 0
    )

/**
 * Runs several /api/search requests in one, each given as its query string in
 * an `r` parameter, and returns each one's status and body in order. A failed
 * request fails only its own entry. Each runs exactly as it would on
 * /api/search, so searches without a query share that endpoint's edge cache.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)
    const queryStrings = url.searchParams.getAll(SEARCH_BATCH_PARAM)
    if (
        queryStrings.length === 0 ||
        queryStrings.length > SEARCH_BATCH_MAX_REQUESTS
    )
        return json(
            {
                error: `Send between 1 and ${SEARCH_BATCH_MAX_REQUESTS} "${SEARCH_BATCH_PARAM}" parameters, each the query string of an /api/search request`,
            },
            400,
            "no-store"
        )

    const responses = await Promise.all(
        queryStrings.map((queryString) =>
            handleSearchRequest(
                new Request(new URL(`/api/search?${queryString}`, url), {
                    headers: request.headers,
                }),
                env,
                (promise) => context.waitUntil(promise)
            )
        )
    )
    const body: SearchApiBatchResponse = {
        results: await Promise.all(
            responses.map(async (response) => ({
                status: response.status,
                body: await response.json(),
            }))
        ),
    }
    // Cached as long as its shortest-lived part, and not at all if one failed
    const cacheControl = responses.every((response) => response.ok)
        ? `public, max-age=${Math.min(...responses.map(maxAgeOf))}`
        : "no-store"
    return json(body, 200, cacheControl)
}
