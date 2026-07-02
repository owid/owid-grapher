import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { pmNodeNames } from "./serialization/pmJson.js"
import {
    enrichedBlockToPmNode,
    enrichedBlocksToPmDoc,
    pmDocToEnrichedBlocks,
} from "./serialization/serialization.js"
import { enrichedBodiesMatch } from "./serialization/normalizeForComparison.js"

// Computed before converting a gdoc to native editing so the author knows
// exactly what they get: which blocks are fully editable, which are carried
// as read-only raw blocks, and whether the round-trip is lossless.

export interface ConversionReport {
    totalBlocks: number
    editableBlocks: number
    /** Top-level blocks that fall back to opaque passthrough, by type */
    rawBlockCounts: Record<string, number>
    /** Whether enriched → ProseMirror → enriched reproduces the body */
    roundTripOk: boolean
    /** Set when the conversion itself threw — do not convert */
    conversionError?: string
}

export function computeConversionReport(
    body: OwidEnrichedGdocBlock[]
): ConversionReport {
    const rawBlockCounts: Record<string, number> = {}
    let editableBlocks = 0

    try {
        for (const block of body) {
            const node = enrichedBlockToPmNode(block)
            if (node.type === pmNodeNames.rawBlock) {
                rawBlockCounts[block.type] =
                    (rawBlockCounts[block.type] ?? 0) + 1
            } else {
                editableBlocks += 1
            }
        }
        const roundTripped = pmDocToEnrichedBlocks(enrichedBlocksToPmDoc(body))
        return {
            totalBlocks: body.length,
            editableBlocks,
            rawBlockCounts,
            roundTripOk: enrichedBodiesMatch(body, roundTripped),
        }
    } catch (error) {
        return {
            totalBlocks: body.length,
            editableBlocks,
            rawBlockCounts,
            roundTripOk: false,
            conversionError: String(error),
        }
    }
}
