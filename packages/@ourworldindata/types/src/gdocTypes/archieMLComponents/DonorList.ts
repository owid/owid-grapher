import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockDonorList = {
    type: "donors"
    value?: Record<string, never> // dummy value to unify block shapes
}

export type EnrichedBlockDonorList = {
    type: "donors"
    value?: Record<string, never> // dummy value to unify block shapes
} & EnrichedBlockWithParseErrors
