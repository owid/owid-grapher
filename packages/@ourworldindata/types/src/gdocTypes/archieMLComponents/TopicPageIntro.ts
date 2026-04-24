import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawBlockTopicPageIntro = {
    type: "topic-page-intro"
    value: {
        "download-button":
            | {
                  text: string
                  url: string
              }
            | undefined
        "related-topics":
            | {
                  text?: string
                  url: string
              }[]
            | undefined
        content: RawBlockText[]
    }
}

export type EnrichedTopicPageIntroRelatedTopic = {
    text?: string
    url: string
    type: "topic-page-intro-related-topic"
}

export type EnrichedTopicPageIntroDownloadButton = {
    text: string
    url: string
    type: "topic-page-intro-download-button"
}

/**
 * The introduction section of a topic page. Renders the topic title,
 * optional download button, optional related-topics chips, and an intro
 * body of rich text.
 *
 * ## When to use
 * - Included on every topic page (`type: topic-page`) as the first block
 *   of the body.
 *
 * ## When NOT to use
 * - On non-topic-page documents (articles, data insights, linear topic
 *   pages, homepage, etc.).
 *
 * ## Variations
 * - `download-button` is optional — omit if there is no canonical
 *   dataset to offer for download.
 * - `related-topics` entries can be gdoc links (metadata resolves
 *   automatically) or external URLs (must supply `text`).
 *
 * @owid-component topic-page-intro
 * @owid-title Topic Page Intro
 * @example Basic
 * ```archie
 * {.topic-page-intro}
 * {.download-button}
 * text: Download all data on this topic
 * url: https://github.com/owid
 * {}
 *
 * [.related-topics]
 * url: https://docs.google.com/document/d/1g_38g_DYBW8yhTJ2-heHJ4UFwBju41xlZGfirV7VZak/edit
 *
 * url: https://ourworldindata.org/co2-and-other-greenhouse-gas-emissions
 * text: CO₂ and Greenhouse Gas Emissions
 * []
 *
 * [+.content]
 * Intro text for this topic page.
 * []
 * {}
 * ```
 * @example Minimal (content only)
 * ```archie
 * {.topic-page-intro}
 * [+.content]
 * A short introduction to the topic.
 * []
 * {}
 * ```
 */
export type EnrichedBlockTopicPageIntro = {
    type: "topic-page-intro"
    downloadButton?: EnrichedTopicPageIntroDownloadButton
    relatedTopics?: EnrichedTopicPageIntroRelatedTopic[]
    content: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
