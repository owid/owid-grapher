import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockConditionalSection = {
    type: "conditional-section"
    value: {
        include?: string
        exclude?: string
        content?: OwidRawGdocBlock[]
    }
}

/**
 * A wrapper that includes or excludes its inner content based on the
 * current rendering context (for example the current entity on a
 * country profile page). Undocumented in the author reference.
 *
 * @owid-component conditional-section
 * @owid-title Conditional Section
 */
export type EnrichedBlockConditionalSection = {
    type: "conditional-section"
    include: string[]
    exclude: string[]
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
