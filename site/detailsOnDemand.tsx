import { BAKED_BASE_URL } from "../settings/clientSettings.mjs"
import {
    ArchiveMetaInformation,
    DetailDictionary,
    fetchWithRetry,
    readFromAssetMap,
} from "@ourworldindata/utils"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { initializeDetailsOnDemand } from "@ourworldindata/components"

declare global {
    interface Window {
        _OWID_ARCHIVE_CONTEXT?: ArchiveMetaInformation
    }
}

const siteAnalytics = new SiteAnalytics()

export async function runDetailsOnDemand(): Promise<void> {
    const runtimeAssetMap =
        (typeof window !== "undefined" &&
            window._OWID_ARCHIVE_CONTEXT?.assets?.runtime) ||
        undefined

    const dodFetchUrl = readFromAssetMap(runtimeAssetMap, {
        path: "dods.json",
        fallback: `${BAKED_BASE_URL}/dods.json`,
    })

    const details: DetailDictionary = await fetchWithRetry(dodFetchUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
        },
    }).then((res) => res.json())

    initializeDetailsOnDemand({
        details,
        onDodShown: (id, dodSpan) =>
            siteAnalytics.logDodShown(id, getDodLocation(dodSpan)),
    })
}

export const DOD_LOCATION_ATTR = "data-dod-location"

/**
 * The page region a DoD span sits in, per the nearest data-dod-location
 * marker (set on data page sections), or undefined if none.
 */
export function getDodLocation(dodSpan: Element): string | undefined {
    return (
        dodSpan
            .closest(`[${DOD_LOCATION_ATTR}]`)
            ?.getAttribute(DOD_LOCATION_ATTR) ?? undefined
    )
}
