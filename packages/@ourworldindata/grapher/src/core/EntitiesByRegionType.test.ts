import { expect, it } from "vitest"
import { GrapherState } from "./GrapherState"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"

it("detects regions based on their suffix", () => {
    const table = SynthesizeGDPTable({
        entityNames: [
            "Europe and Central Asia (WB)", // defined in regions.json
            "Europe & Central Asia (WB)", // alternative name
        ],
    })
    const grapher = new GrapherState({ table })
    expect(grapher.entityNamesByRegionType.get("wb")).toEqual([
        "Europe and Central Asia (WB)",
        "Europe & Central Asia (WB)",
    ])
})
