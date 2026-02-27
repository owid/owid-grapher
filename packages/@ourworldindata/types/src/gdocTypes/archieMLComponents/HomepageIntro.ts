import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockHomepageIntro = {
    type: "homepage-intro"
    value: {
        ["featured-work"]?: RawBlockHomepageIntroPost[]
    }
}

export type RawBlockHomepageIntroPost = {
    url?: string
    title?: string
    description?: string
    kicker?: string
    authors?: string
    filename?: string
    isNew?: string
}

export type EnrichedBlockHomepageIntroPost = {
    url: string
    // the rest are optional because if this is a gdoc, we resolve metadata automatically
    title?: string
    description?: string
    kicker?: string
    authors?: string[]
    filename?: string
    isNew?: boolean
}

export type EnrichedBlockHomepageIntro = {
    type: "homepage-intro"
    featuredWork: EnrichedBlockHomepageIntroPost[]
} & EnrichedBlockWithParseErrors
