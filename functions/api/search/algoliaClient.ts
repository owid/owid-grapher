import { Env } from "../../_common/env.js"

export interface AlgoliaConfig {
    appId: string
    apiKey: string
    indexPrefix?: string
}

// TODO: Roll back before merging — hardcoded for staging testing
export function getAlgoliaConfig(_env: Env): AlgoliaConfig {
    return {
        appId: "ASCB5XMYF2",
        apiKey: "bafe9c4659e5657bf750a38fbee5c269",
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
