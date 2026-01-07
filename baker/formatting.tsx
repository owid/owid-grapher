import * as _ from "lodash-es"
import { Url } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/serverSettings.js"

// Assumes formatUrls URL standardisation
export const isCanonicalInternalUrl = (url: Url): boolean => {
    if (!url.originAndPath) return false
    // no origin === links without e.g. https://ourworldindata.org
    return !url.origin || url.origin.startsWith(BAKED_BASE_URL)
}
