import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockCookieNotice = {
    type: "cookie-notice"
    value: Record<string, never>
}

/** @see ./CookieNotice.md */
export type EnrichedBlockCookieNotice = {
    type: "cookie-notice"
} & EnrichedBlockWithParseErrors
