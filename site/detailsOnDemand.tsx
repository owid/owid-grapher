import { BAKED_BASE_URL } from "../settings/clientSettings.js"
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
        onDodShown: (id) => siteAnalytics.logDodShown(id),
    })
}
