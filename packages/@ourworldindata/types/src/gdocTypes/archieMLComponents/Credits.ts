import { Contributor } from "../Gdoc.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawBlockCredits = {
    type: "credits"
    value: {
        contributors?: string
        acknowledgements?: RawBlockText[]
    }
}

export type EnrichedBlockCredits = {
    type: "credits"
    contributors: Contributor[]
    acknowledgements: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
