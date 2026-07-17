import { expect, it, describe } from "vitest"
import * as _ from "lodash-es"
import { regions, checkIsAggregate } from "@ourworldindata/utils"
import {
    RegionMapColorMap,
    OwidCategoricalMapScheme,
    MapContinentColors,
} from "./CustomSchemes"

describe("region concept colors", () => {
    it("colors the same region concept identically across sources", () => {
        const subSaharanAfricas = [
            RegionMapColorMap["Sub-Saharan Africa (WB)"],
            RegionMapColorMap["Sub-Saharan Africa (UN SDG)"],
            RegionMapColorMap["Sub-Saharan Africa (Pew)"],
            RegionMapColorMap["Sub-Saharan Africa (WID)"],
            RegionMapColorMap["Sub-Saharan Africa (ILO)"],
            RegionMapColorMap["Sub Saharan Africa (Maddison)"],
        ]
        expect(subSaharanAfricas[0]).toBeTruthy()
        expect(new Set(subSaharanAfricas).size).toEqual(1)

        const europes = [
            RegionMapColorMap["Europe"],
            RegionMapColorMap["Europe (UN)"],
            RegionMapColorMap["Europe (WHO)"],
            RegionMapColorMap["Europe (WID)"],
            RegionMapColorMap["Europe and Central Asia (WB)"],
            RegionMapColorMap["Europe and Northern America (UN SDG)"],
        ]
        expect(europes[0]).toBeTruthy()
        expect(new Set(europes).size).toEqual(1)
    })

    it("assigns distinct colors to sibling regions within each source", () => {
        const aggregatesByProvider = _.groupBy(
            regions
                .filter(checkIsAggregate)
                .filter((region) => region.definedBy),
            (region) => region.definedBy
        )
        for (const [provider, aggregates] of Object.entries(
            aggregatesByProvider
        )) {
            const pinnedColors = aggregates
                .map((region) => RegionMapColorMap[region.name])
                .filter((color) => color !== undefined)
            expect(
                new Set(pinnedColors).size,
                `duplicate concept colors among sibling regions of ${provider}`
            ).toEqual(pinnedColors.length)
        }
    })

    it("keeps Arab States distinguishable from its ILO tier-2 siblings", () => {
        // "Arab States (ILO)" appears in both ILO breakdowns, alongside
        // "Northern Africa (ILO)" in the granular one
        expect(RegionMapColorMap["Arab States (ILO)"]).toBeTruthy()
        expect(RegionMapColorMap["Arab States (ILO)"]).not.toEqual(
            RegionMapColorMap["Northern Africa (ILO)"]
        )
    })

    it("is wired up as the categorical map scheme's name-keyed colors", () => {
        expect(OwidCategoricalMapScheme.colorMap).toBe(RegionMapColorMap)
        expect(MapContinentColors["Africa (WHO)"]).toEqual(
            RegionMapColorMap["Africa (WHO)"]
        )
    })
})
