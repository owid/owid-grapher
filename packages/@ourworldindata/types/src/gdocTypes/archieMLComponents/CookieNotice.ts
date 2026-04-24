import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockCookieNotice = {
    type: "cookie-notice"
    value: Record<string, never>
}

/**
 * Renders the site's cookie-consent notice. Internal block — not documented
 * for authors.
 *
 * @owid-component cookie-notice
 * @owid-title Cookie Notice
 */
export type EnrichedBlockCookieNotice = {
    type: "cookie-notice"
} & EnrichedBlockWithParseErrors
