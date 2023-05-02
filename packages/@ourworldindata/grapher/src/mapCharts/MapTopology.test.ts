#! /usr/bin/env jest

import { MapTopology } from "./MapTopology"
import { countries } from "@ourworldindata/utils"

it("contains the same list of mappable countries as regions.json", () => {
    let inTopology = MapTopology.objects.world.geometries.map(
            (region: any) => region.id
        ),
        inRegions = countries
            .filter((entity) => entity.isMappable)
            .map((entity) => entity.name)

    expect(inTopology.sort()).toEqual(inRegions.sort())
})
