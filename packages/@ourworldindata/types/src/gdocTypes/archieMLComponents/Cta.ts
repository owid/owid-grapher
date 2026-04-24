import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockCta = {
    type: "cta"
    value: {
        text?: string
        url?: string
    }
}

/**
 * A simple link rendered with an arrow. Colored blue in data insights, red
 * in other contexts.
 *
 * ## When to use
 * - A single, visually prominent call-to-action link.
 *
 * ## When NOT to use
 * - Prefer `{.prominent-link}` for a richer link tile with title, description,
 *   and thumbnail.
 * - Prefer `{.recirc}` for a list of related links.
 *
 * @owid-component cta
 * @owid-title Cta
 * @example Basic
 * ```archie
 * {.cta}
 * url: https://ourworldindata.org/grapher/life-expectancy
 * text: Check this out!
 * {}
 * ```
 */
export type EnrichedBlockCta = {
    type: "cta"
    text: string
    url: string
} & EnrichedBlockWithParseErrors
