import {
    Region,
    getRegionByNameOrVariantName,
    regions,
    escapeRegExp,
} from "@ourworldindata/utils"

const allCountryNamesAndVariants = regions.flatMap((c) => [
    c.name,
    ...(("variantNames" in c && c.variantNames) || []),
])

// A RegExp that matches any country, region and variant name. Case-independent.
const regionNameRegex = new RegExp(
    `\\b(${allCountryNamesAndVariants.map(escapeRegExp).join("|")})\\b`,
    "gi"
)

export const extractRegionNamesFromSearchQuery = (query: string) => {
    const matches = query.matchAll(regionNameRegex)
    const regionNames = Array.from(matches, (match) => match[0])
    if (regionNames.length === 0) return null
    return regionNames.map(getRegionByNameOrVariantName) as Region[]
}
