import { TypesenseConfig } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"

/**
 * Where the Typesense server is, and the prefix its collections carry: the
 * indexers name a collection like the Algolia index, so a staging server
 * with its own Algolia indices has prefixed collections too.
 */
export type TypesenseApiConfig = TypesenseConfig & { indexPrefix?: string }

// The client itself lives in @ourworldindata/utils; only the config comes
// from the Worker env.
export function getTypesenseConfig(env: Env): TypesenseApiConfig {
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
        indexPrefix: env.ALGOLIA_INDEX_PREFIX,
    }
}
