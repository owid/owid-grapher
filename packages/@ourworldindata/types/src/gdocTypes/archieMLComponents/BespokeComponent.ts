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

/**
 * A self-contained custom data viz component bundled under
 * `bespoke/projects/` and embedded via Shadow DOM. Each bundle can
 * expose multiple variants and accepts a free-form `config` map.
 * Undocumented in the author reference (developer-facing).
 *
 * @owid-component bespoke-component
 * @owid-title Bespoke Component
 */
export type EnrichedBlockBespokeComponent = {
    type: "bespoke-component"
    bundle: string
    variant?: string
    size: BlockSize
    config: Record<string, string>
} & EnrichedBlockWithParseErrors
