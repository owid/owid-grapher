import { regions, getContinents, lazy } from "@ourworldindata/utils"
import { MapProjectionName } from "@ourworldindata/types"

// A map of the form:
// - Africa: [Algeria, Angola, ...]
// - NorthAmerica: [Canada, United States, ...]
const countriesByProjectionMap = lazy(
    () =>
        new Map(
            getContinents().map(({ name: continentName, members }) => {
                const continentNameNoSpace = continentName.replace(
                    / /,
                    ""
                ) as MapProjectionName
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

export const getCountriesByProjection = (projection: MapProjectionName) =>
    countriesByProjectionMap().get(projection)
