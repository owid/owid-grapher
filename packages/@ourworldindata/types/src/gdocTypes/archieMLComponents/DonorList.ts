import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockDonorList = {
    type: "donors"
    value?: Record<string, never> // dummy value to unify block shapes
}

/**
 * A rendered list of OWID's donors, pulled from a curated source. No
 * props.
 *
 * ## When to use
 * - On the donate / about page where the donor list should appear.
 *
 * ## When NOT to use
 * - Anywhere else.
 *
 * @owid-component donors
 * @owid-title Donor List
 * @example Basic
 * ```archie
 * {.donors}
 * {}
 * ```
 */
export type EnrichedBlockDonorList = {
    type: "donors"
    value?: Record<string, never> // dummy value to unify block shapes
} & EnrichedBlockWithParseErrors
