import { expect, it, describe } from "vitest"

import { MapTopology } from "./MapTopology"
import { regions, Country } from "@ourworldindata/utils"

it("contains the same list of mappable countries as regions.json", () => {
    const inTopology = MapTopology.objects.world.geometries.map(
            (region: any) => region.id
        ),
        inRegions = regions
            .filter((entity) => entity.regionType === "country")
            .filter((entity) => (entity as Country).isMappable)
            .map((entity) => entity.name)

    expect(inTopology.sort()).toEqual(inRegions.sort())
})
