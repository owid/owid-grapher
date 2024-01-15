import { regions, continents } from "@ourworldindata/utils"
import { MapProjectionName } from "@ourworldindata/types"

export const WorldRegionToProjection: Map<string, MapProjectionName> =
    Object.fromEntries(
        continents.flatMap(({ name, members }) =>
            members
                .map((code) => [
                    regions.find((c) => c.code === code)?.name,
                    name.replace(/ /, "") as MapProjectionName,
                ])
                .filter(([name, _projection]) => !!name)
        )
    )

export type WorldRegionName = keyof typeof WorldRegionToProjection
