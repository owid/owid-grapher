import { getContinentForCountry, getParentRegions } from "@ourworldindata/utils"

import { DataRow, GroupBy, HeadcountFileJson } from "./PovertyConstants.js"

// Entities in the PIP data that don't map to an OWID continent or World Bank
// region via the regions dataset
const CONTINENT_OVERRIDES: Record<string, string> = {
    "Channel Islands": "Europe",
}

const WB_REGION_OVERRIDES: Record<string, string> = {
    "Channel Islands": "Europe and Central Asia (WB)",
}

export function getContinentForCountryName(
    countryName: string
): string | undefined {
    return (
        getContinentForCountry(countryName) ?? CONTINENT_OVERRIDES[countryName]
    )
}

export function getWbRegionForCountryName(
    countryName: string
): string | undefined {
    const wbRegion = getParentRegions(countryName).find(
        (region) =>
            region.regionType === "aggregate" && region.definedBy === "wb"
    )
    return wbRegion?.name ?? WB_REGION_OVERRIDES[countryName]
}

export function parseHeadcountFile(json: HeadcountFileJson): DataRow[] {
    const rows: DataRow[] = []
    json.countries.forEach((countryName, countryIndex) => {
        const continent = getContinentForCountryName(countryName)
        const wbRegion = getWbRegionForCountryName(countryName)
        if (!continent || !wbRegion) {
            console.warn(
                `Skipping "${countryName}": no continent or World Bank region mapping`
            )
            return
        }
        json.years.forEach((year, yearIndex) => {
            const headcount = json.values[countryIndex][yearIndex]
            if (headcount === null) return
            rows.push({ countryName, continent, wbRegion, year, headcount })
        })
    })
    return rows
}

export function getGroupForRow(row: DataRow, groupBy: GroupBy): string {
    return groupBy === "continent" ? row.continent : row.wbRegion
}
