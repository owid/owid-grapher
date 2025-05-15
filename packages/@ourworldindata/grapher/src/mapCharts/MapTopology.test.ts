import { expect, it } from "vitest"

import { MapTopology } from "./MapTopology"
import { regions, checkIsCountry } from "@ourworldindata/utils"

it("contains the same list of mappable countries as regions.json", () => {
    const inTopology = MapTopology.objects.world.geometries.map(
            (region: any) => region.id
        ),
        inRegions = regions
            .filter((entity) => checkIsCountry(entity) && entity.isMappable)
            .map((entity) => entity.name)

    expect(inTopology.sort()).toEqual(inRegions.sort())
})
