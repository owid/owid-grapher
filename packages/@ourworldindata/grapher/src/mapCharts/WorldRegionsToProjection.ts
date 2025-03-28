import { regions, getContinents, lazy } from "@ourworldindata/utils"
import { MapRegionName } from "@ourworldindata/types"

// A map of the form:
// - Africa: [Algeria, Angola, ...]
// - NorthAmerica: [Canada, United States, ...]
const countriesByRegionMap = lazy(
    () =>
        new Map(
            getContinents().map(({ name: continentName, members }) => {
                const continentNameNoSpace = continentName.replace(
                    / /,
                    ""
                ) as MapRegionName
                return [
                    continentNameNoSpace,
                    new Set(
                        members
                            .map((code) => regions.find((c) => c.code === code))
                            .filter((region) => region !== undefined)
                            .map((region) => region.name)
                    ),
                ]
            })
        )
)

export const getCountriesByRegion = (
    region: MapRegionName
): Set<string> | undefined => countriesByRegionMap().get(region)
