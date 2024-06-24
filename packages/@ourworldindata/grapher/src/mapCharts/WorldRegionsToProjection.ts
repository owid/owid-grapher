import { regions, continents, lazy, Continent } from "@ourworldindata/utils"
import { MapProjectionName } from "@ourworldindata/types"

export const WorldRegionToProjection = lazy(() =>
    Object.fromEntries(
        continents().flatMap(({ name, members }) =>
            members
                .map((code) => [
                    regions.find((c) => c.code === code)?.name,
                    name.replace(/ /, "") as MapProjectionName,
                ])
                .filter(([name, _projection]) => !!name)
        )
    )
)

export type WorldRegionName = Continent["name"]
