import { regions, continents } from "@ourworldindata/utils"
import { MapProjectionName } from "./MapProjections"

export const WorldRegionToProjection = Object.fromEntries(
    continents
        .map(({ name, members }) =>
            members
                .map((code) => [
                    regions.find((c) => c.code === code)?.name,
                    name.replace(/ /, "") as MapProjectionName,
                ])
                .filter(([name, _projection]) => !!name)
        )
        .flat()
)

export type WorldRegionName = keyof typeof WorldRegionToProjection
