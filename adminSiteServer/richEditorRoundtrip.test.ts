// Round-trip contract between stored gdoc content and the rich editor's
// document model. Lives in adminSiteServer because it needs both the example
// fixtures from db/ and the serialization layer from adminSiteClient/ (this
// is the only project that references both).

import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import { Node as PmNode } from "@tiptap/pm/model"
import { enrichedBlockExamples } from "../db/model/Gdoc/exampleEnrichedBlocks.js"
import { getRichEditorBaseExtensions } from "../adminShared/richEditor/extensions.js"
import {
    enrichedBlocksToPmDoc,
    pmDocToEnrichedBlocks,
} from "../adminShared/richEditor/serialization/serialization.js"
import {
    enrichedBodiesMatch,
    normalizedBodyKey,
} from "../adminShared/richEditor/serialization/normalizeForComparison.js"

describe("rich editor round-trip over example blocks", () => {
    const schema = getSchema(getRichEditorBaseExtensions())

    for (const [type, block] of Object.entries(enrichedBlockExamples)) {
        it(`round-trips the example "${type}" block`, () => {
            const original = [block]
            const pmDoc = enrichedBlocksToPmDoc(original)
            // the intermediate document must be valid against the editor schema
            expect(() => PmNode.fromJSON(schema, pmDoc).check()).not.toThrow()
            const result = pmDocToEnrichedBlocks(pmDoc)
            expect(
                enrichedBodiesMatch(original, result),
                `normalized forms differ:\n${normalizedBodyKey(original)}\nvs\n${normalizedBodyKey(result)}`
            ).toBe(true)
        })
    }

    it("keeps unsupported blocks byte-identical (opaque passthrough)", () => {
        const chart = enrichedBlockExamples.chart
        const result = pmDocToEnrichedBlocks(enrichedBlocksToPmDoc([chart]))
        expect(result[0]).toEqual(chart)
    })
})
