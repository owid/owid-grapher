import { TypesenseConfig } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"

// The client itself lives in @ourworldindata/utils so the site and this
// endpoint issue identical requests; only the config comes from the Worker env.
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
