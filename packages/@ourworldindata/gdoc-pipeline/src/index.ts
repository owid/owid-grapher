// The Google Docs / ArchieML content pipeline:
//
//   Google Docs JSON --(gdocToArchie)--> ArchieML text
//   ArchieML text ----(archieToEnriched)--> enriched blocks
//   enriched blocks --(enrichedToRaw + rawToArchie)--> ArchieML text
//   enriched blocks --(enrichedToMarkdown / enrichedToIndexableText)--> text
//
// This package contains only the pure conversion layer. Fetching documents
// from the Google Docs API, the GdocBase class hierarchy and everything that
// touches the database stay in the monorepo (db/model/Gdoc/).

export * from "./archieToEnriched.js"
export * from "./enrichedToIndexableText.js"
export * from "./enrichedToMarkdown.js"
export * from "./enrichedToRaw.js"
export * from "./exampleEnrichedBlocks.js"
export * from "./extractGdocComponentInfo.js"
export * from "./gdocToArchie.js"
export * from "./gdocUtils.js"
export * from "./gdocValidation.js"
export * from "./htmlToEnriched.js"
export * from "./rawToArchie.js"
export * from "./rawToEnriched.js"
export * from "./sha1.js"

// Inside the monorepo, import these from their home packages instead. The
// re-exports below exist for consumers of the published npm package: the
// @ourworldindata workspace packages aren't published individually, so
// everything of theirs that is part of this pipeline's API surface has to be
// reachable through this package.

// The full type surface the pipeline is expressed in (raw and enriched block
// unions, spans, gdoc content types, ...).
export type * from "@ourworldindata/types"

export {
    ALL_CHARTS_ID,
    KEY_INSIGHTS_ID,
    RESEARCH_AND_WRITING_ID,
    RESEARCH_AND_WRITING_DEFAULT_HEADING,
    CALLOUT_FUNCTIONS,
    BlockSize,
    ContentGraphLinkType,
    HorizontalAlign,
    OwidGdocType,
    SocialLinkType,
    gdocUrlRegex,
    isValidPeerCountryStrategyQueryParam,
    serializePostGdocComponentConfig,
} from "@ourworldindata/types"

export {
    Url,
    checkNodeIsSpan,
    checkShouldDataCalloutRender,
    detailOnDemandRegex,
    excludeNullish,
    excludeUndefined,
    getCalloutValue,
    guidedChartRegex,
    lowercaseObjectKeys,
    makeLinkedCalloutKey,
    omitUndefinedValues,
    plaintextCalloutRegex,
    recursivelyMapArticleContent,
    spansToUnformattedPlainText,
    toAsciiQuotes,
    traverseEnrichedBlock,
    traverseEnrichedSpan,
    validateConditionalSectionLists,
} from "@ourworldindata/utils"

export {
    checkIsInternalLink,
    convertHeadingTextToId,
    getLinkType,
} from "@ourworldindata/components"
