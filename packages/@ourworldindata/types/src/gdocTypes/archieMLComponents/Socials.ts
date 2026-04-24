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

/**
 * A list of social / contact links. Used on author pages (as the
 * `[socials]` section) and inside `{.person}` blocks on about pages.
 *
 * ## When to use
 * - On an author page to link to the author's social profiles and
 *   email.
 * - Inside a `{.person}` block on an about page.
 *
 * ## When NOT to use
 * - Inline in article body — use normal links.
 *
 * ## Variations
 * - `type` values: `link`, `email`, `x`, `facebook`, `instagram`,
 *   `youtube`, `linkedin`, `threads`, `mastodon`, `bluesky`.
 *
 * @owid-component socials
 * @owid-title Socials
 * @example Author socials
 * ```archie
 * [socials]
 * url: saloni@ourworldindata.org
 * text: saloni@ourworldindata.org
 * type: email
 *
 * url: https://twitter.com/salonium
 * text: @salonium
 * type: x
 * []
 * ```
 */
export type EnrichedBlockSocials = {
    type: "socials"
    links: EnrichedSocialLink[]
} & EnrichedBlockWithParseErrors
