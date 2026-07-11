import { HIGHLIGHTS_LABEL, WORLD_CODE } from "./catalog.js"

// URL params are namespaced (like the demography bundle's demographyCountry)
// so the component can't clash with other query params on the page.
export const COUNTRY_PARAM = "lifeCountry"
export const YEAR_PARAM = "lifeYear"
export const TOPIC_PARAM = "lifeTopic"
export const COMPARE_PARAM = "lifeCompare"

// Opt-in via the ArchieML config (urlSync: true), set once at mount.
let urlSyncEnabled = false

export function enableUrlSync(): void {
    urlSyncEnabled = true
}

/**
 * Reflect the current state in the URL (without adding history entries), so
 * every card is shareable: ?lifeCountry=CZE&lifeYear=1993. Only the default-
 * differing params are written, and other query params are left untouched.
 */
export function writeStateToUrl(state: {
    countryCode: string
    birthYear: number
    topic: string
    compareCode: string
}): void {
    if (!urlSyncEnabled) return
    const params = new URLSearchParams(window.location.search)
    params.set(COUNTRY_PARAM, state.countryCode)
    params.set(YEAR_PARAM, String(state.birthYear))
    if (state.topic !== HIGHLIGHTS_LABEL) params.set(TOPIC_PARAM, state.topic)
    else params.delete(TOPIC_PARAM)
    if (state.compareCode !== WORLD_CODE)
        params.set(COMPARE_PARAM, state.compareCode)
    else params.delete(COMPARE_PARAM)
    const query = params.toString()
    window.history.replaceState(
        null,
        "",
        query
            ? `${window.location.pathname}?${query}${window.location.hash}`
            : `${window.location.pathname}${window.location.hash}`
    )
}
