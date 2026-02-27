import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export enum SocialLinkType {
    X = "x",
    Facebook = "facebook",
    Instagram = "instagram",
    Youtube = "youtube",
    Linkedin = "linkedin",
    Threads = "threads",
    Mastodon = "mastodon",
    Bluesky = "bluesky",
    Email = "email",
    Link = "link",
}

export type RawSocialLink = {
    text?: string
    url?: string
    type?: SocialLinkType
}

export type RawBlockSocials = {
    type: "socials"
    value: RawSocialLink[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedSocialLink = {
    text: string
    url: string
    type?: SocialLinkType
} & EnrichedBlockWithParseErrors

export type EnrichedBlockSocials = {
    type: "socials"
    links: EnrichedSocialLink[]
} & EnrichedBlockWithParseErrors
