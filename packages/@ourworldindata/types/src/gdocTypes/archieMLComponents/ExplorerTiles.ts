import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockExplorerTiles = {
    type: "explorer-tiles"
    value: {
        title?: string
        subtitle?: string
        explorers?: { url: string }[]
    }
}

export type EnrichedBlockExplorerTiles = {
    type: "explorer-tiles"
    title: string
    subtitle: string
    explorers: { url: string }[]
} & EnrichedBlockWithParseErrors
