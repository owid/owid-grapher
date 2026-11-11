/**
 * Helpers for the optional ALGOLIA_HOST setting, which redirects every Algolia
 * call to another server that speaks the Algolia REST API (e.g. a local
 * stand-in at http://127.0.0.1:8799). When the setting is empty, calls go to
 * Algolia as usual.
 */

export interface AlgoliaHostOption {
    url: string
    port?: number
    protocol: "http" | "https"
    accept: "readWrite"
}

/**
 * Options to spread into an Algolia SDK client. Returns no `hosts` key at all
 * when the setting is empty: the SDK merges options over its defaults, so
 * `hosts: undefined` would wipe the Algolia hosts.
 */
export function getAlgoliaHostClientOptions(algoliaHost: string | undefined): {
    hosts?: AlgoliaHostOption[]
} {
    if (!algoliaHost) return {}
    const { hostname, port, protocol } = new URL(algoliaHost)
    return {
        hosts: [
            {
                url: hostname,
                ...(port && { port: Number(port) }),
                protocol: protocol === "http:" ? "http" : "https",
                accept: "readWrite",
            },
        ],
    }
}

/** Base URL for raw fetches to the Algolia REST API. */
export function getAlgoliaBaseUrl(
    appId: string,
    algoliaHost: string | undefined
): string {
    if (!algoliaHost) return `https://${appId}-dsn.algolia.net`
    return algoliaHost.replace(/\/+$/, "")
}
