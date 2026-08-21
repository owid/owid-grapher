import { BlockSize, EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockBespokeComponent = {
    type: "bespoke-component"
    value: {
        bundle?: string
        variant?: string
        size?: BlockSize
        config?: Record<string, string>
    }
}

/** @see ./BespokeComponent.md */
export type EnrichedBlockBespokeComponent = {
    type: "bespoke-component"
    bundle: string
    variant?: string
    size: BlockSize
    config: Record<string, string>
} & EnrichedBlockWithParseErrors
