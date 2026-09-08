import { describe, expect, it } from "vitest"
import { SidecarExample } from "@ourworldindata/types"
import { exampleIndexForFence } from "./gdocsReferenceExamples.js"

const source = "{.chart}\nurl: https://ourworldindata.org/grapher/x\n{}"
const examples: SidecarExample[] = [
    { archie: source, flavour: "archie", section: "intro", position: 0 },
    { archie: source, flavour: "archie-document", section: "intro", position: 1 },
    { archie: "{.image}\n{}", flavour: "archie", section: "notes", position: 0 },
]

describe("exampleIndexForFence", () => {
    it("resolves identical sources with different flavours to different examples", () => {
        expect(exampleIndexForFence(examples, "intro", 0)).toBe(0)
        expect(exampleIndexForFence(examples, "intro", 1)).toBe(1)
    })

    it("counts fences per section", () => {
        expect(exampleIndexForFence(examples, "notes", 0)).toBe(2)
    })

    it("returns undefined for a fence the registry does not know", () => {
        expect(exampleIndexForFence(examples, "notes", 1)).toBeUndefined()
        expect(exampleIndexForFence(examples, "whenToUse", 0)).toBeUndefined()
    })
})
