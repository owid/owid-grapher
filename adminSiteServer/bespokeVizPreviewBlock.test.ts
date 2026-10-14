import { describe, expect, it } from "vitest"
import type { BundleReference } from "@ourworldindata/types"
import {
    PreviewQueryParam,
    selectBespokePreviewBlock,
} from "./bespokeVizPreviewBlock.js"

// A bundle with one variant and two docs.md examples. The committed registry
// has no examples yet, so the example path is tested against this fixture.
const bundles = [
    {
        id: "demo",
        variants: [{ name: "chart", archie: "chart default block" }],
        examples: [{ archie: "first example" }, { archie: "second example" }],
    },
] as unknown as BundleReference[]

const given = (value: string): PreviewQueryParam => ({ given: true, value })
const absent: PreviewQueryParam = { given: false, value: undefined }
// What the router passes for a repeated param (?x=a&x=b)
const repeated: PreviewQueryParam = { given: true, value: undefined }

describe(selectBespokePreviewBlock, () => {
    it("picks the example at ?example=<n>", () => {
        expect(
            selectBespokePreviewBlock(bundles, "demo", absent, given("0"))
        ).toEqual({ title: "demo #1", archie: "first example" })
        expect(
            selectBespokePreviewBlock(bundles, "demo", absent, given("1"))
        ).toEqual({ title: "demo #2", archie: "second example" })
    })

    it("picks the variant's default block at ?variant=<name>", () => {
        expect(
            selectBespokePreviewBlock(bundles, "demo", given("chart"), absent)
        ).toEqual({ title: "demo chart", archie: "chart default block" })
    })

    it.each([
        ["an unknown bundle", "nope", given("chart"), absent],
        ["an unknown variant", "demo", given("map"), absent],
        ["an empty variant", "demo", given(""), absent],
        ["a repeated variant", "demo", repeated, absent],
        ["an out-of-range index", "demo", absent, given("2")],
        ["a non-integer index", "demo", absent, given("1.5")],
        ["an empty index", "demo", absent, given("")],
        ["a negative index", "demo", absent, given("-1")],
        ["a repeated example", "demo", absent, repeated],
        ["both params", "demo", given("chart"), given("0")],
        ["neither param", "demo", absent, absent],
    ])("404s for %s", (_case, bundleId, variant, example) => {
        expect(() =>
            selectBespokePreviewBlock(bundles, bundleId, variant, example)
        ).toThrow(expect.objectContaining({ status: 404 }))
    })
})
