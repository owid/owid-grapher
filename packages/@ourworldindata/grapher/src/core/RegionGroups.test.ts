import { expect, it } from "vitest"
import {
    getRegionPublishers,
    toPublisherLookupKey,
} from "@ourworldindata/utils"
import { GrapherState } from "./GrapherState"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import { ADDITIONAL_REGION_PUBLISHERS } from "./GrapherConstants"
import { parseLabel } from "./RegionGroups"

it("detects regions based on their suffix", () => {
    const table = SynthesizeGDPTable({
        entityNames: [
            "Europe and Central Asia (WB)", // defined in regions.ts
            "Europe & Central Asia (WB)", // alternative name
        ],
    })
    const grapher = new GrapherState({ table })
    expect(grapher.entitiesByRegionGroup.get("wb")).toEqual([
        "Europe and Central Asia (WB)",
        "Europe & Central Asia (WB)",
    ])
})

it("groups a publisher's region sets under their shared suffix", () => {
    const table = SynthesizeGDPTable({
        entityNames: [
            "High-income (IHME GBD)", // ihme_gbd_1
            "Andean Latin America (IHME GBD)", // ihme_gbd_2
        ],
    })
    const grapher = new GrapherState({ table })
    expect(grapher.entitiesByRegionGroup.get("ihme_gbd")).toEqual([
        "High-income (IHME GBD)",
        "Andean Latin America (IHME GBD)",
    ])
})

it("matches a suffix however its separators are spelled", () => {
    // The data isn't consistent about either, so both spellings have to land on the key
    expect(parseLabel("Andean Latin America (IHME GBD)").publisherKey).toBe(
        "ihme_gbd"
    )
    expect(parseLabel("Andean Latin America (IHMEGBD)").publisherKey).toBe(
        "ihme_gbd"
    )
    expect(parseLabel("Africa (pip)").publisherKey).toBe("pip")
    // Trailing whitespace shows up in hand-curated entity lists
    expect(parseLabel("Africa (PIP) ").publisherKey).toBe("pip")
})

it("has no two publishers sharing a lookup key", () => {
    // Separators are dropped to look a suffix up, so two publisher keys differing only in
    // theirs would be indistinguishable and one would silently never match
    const publishers = [
        ...getRegionPublishers(),
        ...ADDITIONAL_REGION_PUBLISHERS,
    ]
    const lookupKeys = publishers.map(toPublisherLookupKey)

    expect(lookupKeys).toEqual([...new Set(lookupKeys)])
})

it("has no publisher listed as additional that the regions file now defines", () => {
    // Once the ETL picks up one of these publishers, its key gets derived from the region
    // names and the entry here becomes dead weight — remove it
    const derived = new Set<string>(getRegionPublishers())
    const stale = ADDITIONAL_REGION_PUBLISHERS.filter((publisher) =>
        derived.has(publisher)
    )
    expect(stale).toEqual([])
})
