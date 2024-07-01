import { regions, getContinents, lazy, Continent } from "@ourworldindata/utils"
import { MapProjectionName } from "@ourworldindata/types"

// Returns a map of the form:
// - Spain: Europe
// - United States: NorthAmerica

export const getCountryToProjectionMap = lazy(
    () =>
        new Map<string, MapProjectionName>(
            getContinents().flatMap(({ name: continentName, members }) => {
                const continentNameNoSpace = continentName.replace(
                    / /,
                    ""
                ) as MapProjectionName

                return members
                    .map((code) => [
                        regions.find((c) => c.code === code)?.name,
                        continentNameNoSpace,
                    ])
                    .filter(
                        ([regionName, _projection]) => regionName !== undefined
                    ) as [string, MapProjectionName][]
            })
        )
)

export type WorldRegionName = Continent["name"]
