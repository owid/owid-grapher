import { describe, expect, it } from "vitest"
import { topicAreasFromSearchParams } from "./useNotificationPreferences.js"

describe(topicAreasFromSearchParams, () => {
    const areas = ["Energy and Environment", "CO2 & Greenhouse Gas Emissions"]

    it("reads ?topics= the way /search and /latest do", () => {
        expect(
            topicAreasFromSearchParams(
                new URLSearchParams({
                    topics: "CO2 & Greenhouse Gas Emissions",
                }),
                areas
            )
        ).toEqual(["CO2 & Greenhouse Gas Emissions"])
        expect(
            topicAreasFromSearchParams(
                new URLSearchParams({
                    topics: "Energy and Environment~CO2 & Greenhouse Gas Emissions",
                }),
                areas
            )
        ).toEqual(areas)
    })

    it("drops unknown areas", () => {
        expect(
            topicAreasFromSearchParams(
                new URLSearchParams({
                    topics: "Health~Energy and Environment",
                }),
                areas
            )
        ).toEqual(["Energy and Environment"])
        expect(
            topicAreasFromSearchParams(new URLSearchParams(), areas)
        ).toEqual([])
    })
})
