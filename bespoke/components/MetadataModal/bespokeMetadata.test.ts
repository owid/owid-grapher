import { describe, expect, it } from "vitest"

import { getBespokeSourceLine } from "./bespokeMetadata.js"

describe(getBespokeSourceLine, () => {
    it("takes the metadata's attribution as it is", () => {
        expect(
            getBespokeSourceLine({
                attribution: "Our World in Data based on FAO (2025)",
                origins: [{ producer: "FAO", datePublished: "2025-01-01" }],
            })
        ).toBe("Our World in Data based on FAO (2025)")
    })

    it("lists each origin once when there is no attribution", () => {
        expect(
            getBespokeSourceLine({
                origins: [
                    { producer: "FAO", datePublished: "2025-01-01" },
                    { producer: "FAO", datePublished: "2025-01-01" },
                    { producer: "Feedipedia", datePublished: "2020" },
                ],
            })
        ).toBe("FAO (2025); Feedipedia (2020)")
    })

    it("shortens more than three origins, as a chart footer does", () => {
        expect(
            getBespokeSourceLine({
                origins: [
                    { producer: "A" },
                    { producer: "B" },
                    { producer: "C" },
                    { producer: "D" },
                ],
            })
        ).toBe("A and other sources")
    })
})
