import { Env } from "../../_common/env.js"

export interface AlgoliaConfig {
    appId: string
    apiKey: string
    indexPrefix?: string
}

export function getAlgoliaConfig(env: Env): AlgoliaConfig {
    const appId = env.ALGOLIA_ID
    const apiKey = env.ALGOLIA_SEARCH_KEY

    if (!appId || !apiKey) {
        throw new Error("Missing ALGOLIA_ID or ALGOLIA_SEARCH_KEY")
    }

    return {
        appId,
        apiKey,
        indexPrefix: env.ALGOLIA_INDEX_PREFIX,
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
