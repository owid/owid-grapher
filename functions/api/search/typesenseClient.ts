import { Env } from "../../_common/env.js"

export interface TypesenseConfig {
    host: string
    port: number
    protocol: string
    apiKey: string
}

export function getTypesenseConfig(env: Env): TypesenseConfig {
    const host = env.TYPESENSE_HOST
    const apiKey = env.TYPESENSE_SEARCH_KEY

    if (!host || !apiKey) {
        throw new Error("Missing TYPESENSE_HOST or TYPESENSE_SEARCH_KEY")
    }

    return {
        host,
        port: parseInt(env.TYPESENSE_PORT ?? "443"),
        protocol: env.TYPESENSE_PROTOCOL ?? "https",
        apiKey,
    }
}

/**
 * Perform a search against a Typesense collection using the REST API.
 * We use fetch() directly because the `typesense` npm package relies on
 * Node.js APIs that are not available in Cloudflare Workers.
 */
export async function typesenseSearch(
    config: TypesenseConfig,
    collection: string,
    params: Record<string, string | undefined>
): Promise<TypesenseSearchResponse> {
    const url = new URL(
        `${config.protocol}://${config.host}:${config.port}/collections/${collection}/documents/search`
    )

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            url.searchParams.set(key, value)
        }
    }

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "X-TYPESENSE-API-KEY": config.apiKey,
        },
    })

    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Typesense search failed (${response.status}): ${body}`)
    }

    return (await response.json()) as TypesenseSearchResponse
}

/** A hit from a Typesense search response. */
export interface TypesenseHit<T = Record<string, unknown>> {
    document: T
    highlights?: Array<{
        field: string
        snippet?: string
        matched_tokens?: string[]
    }>
    text_match?: number
    vector_distance?: number
}

/** A group of hits when using group_by. */
export interface TypesenseGroupedHit<T = Record<string, unknown>> {
    group_key: string[]
    hits: TypesenseHit<T>[]
    found?: number
}

/** Typesense search response shape. */
export interface TypesenseSearchResponse<T = Record<string, unknown>> {
    found: number
    hits?: TypesenseHit<T>[]
    grouped_hits?: TypesenseGroupedHit<T>[]
    page: number
    search_time_ms: number
    out_of: number
}
