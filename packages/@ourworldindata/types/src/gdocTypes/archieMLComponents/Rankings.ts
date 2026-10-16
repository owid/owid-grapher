import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

/**
 * "highest" ranks the largest value first (higher is better),
 * "lowest" ranks the smallest value first (lower is better).
 */
export type RankingSortOrder = "highest" | "lowest"

export type RawRankingCard = {
    url?: string
    title?: string
    topic?: string
    sort?: string
    column?: string
}

export type RawBlockRankingCards = {
    type: "ranking-cards"
    value:
        | {
              title?: string
              subtitle?: string
              sparklines?: string
              "change-since"?: string
              cards?: RawRankingCard[]
          }
        | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedRankingCard = {
    url: string
    title?: string
    topic?: string
    sort: RankingSortOrder
    column?: string
}

/** @see [RankingCards.md](./RankingCards.md) */
export type EnrichedBlockRankingCards = {
    type: "ranking-cards"
    title?: string
    subtitle?: string
    sparklines: boolean
    changeSinceYears: number
    cards: EnrichedRankingCard[]
} & EnrichedBlockWithParseErrors

export type RawBlockPeerRanking = {
    type: "peer-ranking"
    value:
        | {
              url?: string
              title?: string
              groups?: string
              sort?: string
              tolerance?: string
              column?: string
          }
        | ArchieMLUnexpectedNonObjectValue
}

/** @see [PeerRanking.md](./PeerRanking.md) */
export type EnrichedBlockPeerRanking = {
    type: "peer-ranking"
    url: string
    title?: string
    groups: string[]
    sort: RankingSortOrder
    tolerance?: number
    column?: string
} & EnrichedBlockWithParseErrors

export type RawPeerComparisonIndicator = {
    url?: string
    title?: string
    column?: string
}

export type RawBlockPeerComparison = {
    type: "peer-comparison"
    value:
        | {
              title?: string
              groups?: string
              indicators?: RawPeerComparisonIndicator[]
          }
        | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedPeerComparisonIndicator = {
    url: string
    title?: string
    column?: string
}

/** @see [PeerComparison.md](./PeerComparison.md) */
export type EnrichedBlockPeerComparison = {
    type: "peer-comparison"
    title?: string
    groups: string[]
    indicators: EnrichedPeerComparisonIndicator[]
} & EnrichedBlockWithParseErrors
