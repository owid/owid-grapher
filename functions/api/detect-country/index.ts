import { Env } from "../../_common/env.js"
import {
    regions,
    getParentRegions,
    checkIsCountry,
} from "@ourworldindata/utils"
import { UserCountryInformation } from "@ourworldindata/types"

// Build a lookup map from ISO 3166-1 alpha-2 (shortCode) to country response
const countriesByShortCode: Record<string, UserCountryInformation> = {}
for (const region of regions) {
    if (!checkIsCountry(region)) continue
    if (!region.shortCode) continue

    const parentRegionCodes = getParentRegions(region.name).map((r) => r.code)

    countriesByShortCode[region.shortCode] = {
        code: region.code,
        name: region.name,
        short_code: region.shortCode,
        slug: region.slug,
        regions: parentRegionCodes.length > 0 ? parentRegionCodes : null,
    }
}

const RESPONSE_HEADERS: HeadersInit = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=0, max-age=7200", // 2 hours
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
    const shortCode = (request.cf?.country as string) ?? undefined
    if (!shortCode) {
        return Response.json({ country: null }, { headers: RESPONSE_HEADERS })
    }

    const countryInfo = countriesByShortCode[shortCode]
    return Response.json(
        { country: countryInfo ?? null },
        { headers: RESPONSE_HEADERS }
    )
}
