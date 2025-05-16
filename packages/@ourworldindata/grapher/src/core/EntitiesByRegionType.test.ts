import { expect, it } from "vitest"
import { Grapher } from "../core/Grapher"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"

it("detects regions based on their suffix", () => {
    const table = SynthesizeGDPTable({
        entityNames: [
            "Europe and Central Asia (WB)", // defined in regions.json
            "Europe & Central Asia (WB)", // alternative name
        ],
    })
    const grapher = new Grapher({ table })
    expect(grapher.entityNamesByRegionType.get("wb")).toEqual([
        "Europe and Central Asia (WB)",
        "Europe & Central Asia (WB)",
    ])
})
