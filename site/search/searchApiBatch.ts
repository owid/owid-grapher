import * as R from "remeda"
import {
    SEARCH_BATCH_MAX_REQUESTS,
    SEARCH_BATCH_PARAM,
    type SearchApiBatchResponse,
} from "@ourworldindata/utils"

interface PendingRequest {
    params: URLSearchParams
    resolve: (body: unknown) => void
    reject: (error: Error) => void
}

const requestFailed = (status: number): Error =>
    new Error(`Search API request failed: ${status}`)

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url)
    if (!response.ok) throw requestFailed(response.status)
    return response.json()
}

/**
 * Sends /api/search requests (given as their query parameters) and resolves
 * each with its JSON body. The requests made in the same task, such as the
 * result sections of a search page rendering together, go out as one
 * /api/search/batch request: parallel requests to Cloudflare Pages Functions
 * tend to start a new isolate each, and each start costs ~0.5 s. A lone
 * request (a section's next page, a retry) goes to /api/search itself.
 */
export function createSearchApiFetcher(
    apiUrl: string
): (params: URLSearchParams) => Promise<unknown> {
    let pending: PendingRequest[] = []

    async function send(requests: PendingRequest[]): Promise<void> {
        if (requests.length === 1) {
            const [request] = requests
            await fetchJson(`${apiUrl}?${request.params}`).then(
                request.resolve,
                request.reject
            )
            return
        }
        const batchParams = new URLSearchParams(
            requests.map(({ params }) => [
                SEARCH_BATCH_PARAM,
                params.toString(),
            ])
        )
        try {
            const { results } = (await fetchJson(
                `${apiUrl}/batch?${batchParams}`
            )) as SearchApiBatchResponse
            requests.forEach((request, i) => {
                const result = results[i]
                if (result?.status === 200) request.resolve(result.body)
                else request.reject(requestFailed(result?.status ?? 0))
            })
        } catch (error) {
            for (const request of requests) request.reject(error as Error)
        }
    }

    function flush(): void {
        const requests = pending
        pending = []
        for (const chunk of R.chunk(requests, SEARCH_BATCH_MAX_REQUESTS))
            void send(chunk)
    }

    return (params) =>
        new Promise((resolve, reject) => {
            pending.push({ params, resolve, reject })
            // A macrotask rather than a microtask: React Query may call
            // sibling sections' query functions a few promise ticks apart
            if (pending.length === 1) setTimeout(flush, 0)
        })
}
