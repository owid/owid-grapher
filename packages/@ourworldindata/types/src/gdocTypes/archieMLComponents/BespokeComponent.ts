import { BlockSize, EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockBespokeComponent = {
    type: "bespoke-component"
    value: {
        bundle?: string
        variant?: string
        size?: BlockSize
        config?: Record<string, unknown>
    }
}

export type EnrichedBlockBespokeComponent = {
    type: "bespoke-component"
    bundle: string
    variant?: string
    size: BlockSize
    config: Record<string, unknown>
} & EnrichedBlockWithParseErrors
