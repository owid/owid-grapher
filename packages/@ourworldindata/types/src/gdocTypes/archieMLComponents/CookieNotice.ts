import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockCookieNotice = {
    type: "cookie-notice"
    value: Record<string, never>
}

export type EnrichedBlockCookieNotice = {
    type: "cookie-notice"
} & EnrichedBlockWithParseErrors
