import * as _ from "lodash-es"
import {
    OwidRawGdocBlock,
    RawBlockHeading,
    RawBlockRecirc,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockDonorList,
    RawBlockGraySection,
    RawBlockHomepageIntro,
    RawBlockHorizontalRule,
    RawBlockHtml,
    RawBlockImage,
    RawBlockVideo,
    RawBlockList,
    RawBlockNumberedList,
    RawBlockPosition,
    RawBlockProminentLink,
    RawBlockPullQuote,
    RawBlockScroller,
    RawBlockSDGGrid,
    RawBlockSideBySideContainer,
    RawBlockStickyLeftContainer,
    RawBlockStickyRightContainer,
    RawBlockText,
    RawBlockUrl,
    RawBlockAdditionalCharts,
    RawBlockAllCharts,
    RawBlockCallout,
    RawBlockKeyInsights,
    RawBlockResearchAndWriting,
    RawBlockResearchAndWritingLink,
    RawBlockTopicPageIntro,
    RawBlockExpandableParagraph,
    RawBlockAlign,
    RawBlockEntrySummary,
    RawBlockTable,
    RawBlockTableRow,
    RawBlockBlockquote,
    RawBlockKeyIndicator,
    RawBlockKeyIndicatorCollection,
    RawBlockExplorerTiles,
    RawBlockPillRow,
    RawBlockHomepageSearch,
    RawBlockLatestDataInsights,
    RawBlockSocials,
    RawBlockPeople,
    RawBlockPeopleRows,
    RawBlockPerson,
    RawBlockNarrativeChart,
    RawBlockCode,
    RawBlockCookieNotice,
    RawBlockExpander,
} from "@ourworldindata/types"
import { match } from "ts-pattern"

export function appendDotEndIfMultiline(
    line: string | boolean | null | undefined
): string {
    if (typeof line === "boolean") return line ? "true" : "false"
    if (line && line.includes("\n")) return line + "\n:end"
    return line ?? ""
}

export function* encloseLinesAsPropertyPossiblyMultiline(
    key: string,
    lines: Iterable<string>
): Generator<string, void, unknown> {
    let first = true
    let multiLine = false
    for (const line of lines) {
        if (first) {
            yield `${key}: ${line}`
            first = false
        } else {
            yield line
            multiLine = true
        }
    }
    if (multiLine) yield ":end"
}

export function keyValueToArchieMlString(
    key: string,
    val: string | undefined | null
): string {
    if (val !== undefined) return `${key}: ${appendDotEndIfMultiline(val)}`
    return ""
}

// The Record<string, any> here is not ideal - it would be nicer to
// restrict the field type to string but then it only works if all
// fields are strings. Maybe there is some TS magic to do this?
export function* propertyToArchieMLString<T extends Record<string, any>>(
    key: keyof T,
    value: T | undefined
): Generator<string, void, undefined> {
    if (value !== undefined)
        if (typeof value === "string") {
            // This is a case where the user gave a string value instead of an object
            // We assume that this was an error here. Not handling this here would make
            // the serialization code below more complex.
        } else if (key in value && value[key] !== undefined)
            yield `${String(key)}: ${appendDotEndIfMultiline(value[key])}`
}

function* rawBlockAsideToArchieMLString(
    block: RawBlockAside
): Generator<string, void, undefined> {
    yield "{.aside}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("position", block.value)
        yield* propertyToArchieMLString("caption", block.value)
    }
    yield "{}"
}

function* rawBlockChartToArchieMLString(
    block: RawBlockChart
): Generator<string, void, undefined> {
    yield "{.chart}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("url", block.value)
        yield* propertyToArchieMLString("height", block.value)
        yield* propertyToArchieMLString("row", block.value)
        yield* propertyToArchieMLString("column", block.value)
        yield* propertyToArchieMLString("position", block.value)
        yield* propertyToArchieMLString("caption", block.value)
    }
    yield "{}"
}

function* rawBlockNarrativeChartToArchieMLString(
    block: RawBlockNarrativeChart
): Generator<string, void, undefined> {
    yield "{.narrative-chart}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("name", block.value)
        yield* propertyToArchieMLString("height", block.value)
        yield* propertyToArchieMLString("row", block.value)
        yield* propertyToArchieMLString("column", block.value)
        yield* propertyToArchieMLString("position", block.value)
        yield* propertyToArchieMLString("caption", block.value)
    }
    yield "{}"
}

function* rawBlockCodeToArchieMLString(
    block: RawBlockCode
): Generator<string, void, undefined> {
    yield "[.+code]"
    for (const text of block.value) {
        yield* OwidRawGdocBlockToArchieMLStringGenerator(text)
    }
    yield "[]"
}

function* rawBlockDonorListToArchieMLString(
    _block: RawBlockDonorList
): Generator<string, void, undefined> {
    yield "{.donors}"
    yield "{}"
}

function* rawBlockScrollerToArchieMLString(
    block: RawBlockScroller
): Generator<string, void, undefined> {
    yield "[.+scroller]"
    if (typeof block.value !== "string")
        for (const b of block.value)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
    yield "[]"
}

function* rawBlockChartStoryToArchieMLString(
    block: RawBlockChartStory
): Generator<string, void, undefined> {
    yield "[.chart-story]"
    if (typeof block.value !== "string") {
        for (const item of block.value) {
            yield* propertyToArchieMLString("narrative", item)
            yield* propertyToArchieMLString("chart", item)
            yield "{.technical}"
            if (item.technical?.list) {
                yield* listToArchieMLString(item.technical.list, "list")
            }
            yield "{}"
        }
    }
    yield "[]"
}

function* rawBlockCalloutToArchieMLString(
    block: RawBlockCallout
): Generator<string, void, undefined> {
    yield "{.callout}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("title", block.value)
        yield "[.+text]"
        for (const rawBlock of block.value.text) {
            yield* OwidRawGdocBlockToArchieMLStringGenerator(rawBlock)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockImageToArchieMLString(
    block: RawBlockImage
): Generator<string, void, undefined> {
    yield "{.image}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("filename", block.value)
        yield* propertyToArchieMLString("smallFilename", block.value)
        yield* propertyToArchieMLString("caption", block.value)
        yield* propertyToArchieMLString("size", block.value)
        yield* propertyToArchieMLString("hasOutline", block.value)
        yield* propertyToArchieMLString("alt", block.value)
    }
    yield "{}"
}

function* rawBlockVideoToArchieMLString(
    block: RawBlockVideo
): Generator<string, void, undefined> {
    yield "{.video}"
    yield* propertyToArchieMLString("url", block.value)
    yield* propertyToArchieMLString("filename", block.value)
    yield* propertyToArchieMLString("shouldLoop", block.value)
    yield* propertyToArchieMLString("caption", block.value)
    yield "{}"
}

function* listToArchieMLString(
    items: string[] | string,
    blockName: string
): Generator<string, void, undefined> {
    yield `[.${blockName}]`
    if (typeof items !== "string") for (const item of items) yield `* ${item}`
    yield "[]"
}

function* rawBlockListToArchieMLString(
    block: RawBlockList
): Generator<string, void, undefined> {
    yield* listToArchieMLString(block.value, "list")
}

function* rawBlockNumberedListToArchieMLString(
    block: RawBlockNumberedList
): Generator<string, void, undefined> {
    yield* listToArchieMLString(block.value, "numbered-list")
}

function* rawBlockPeopleToArchieMLString(
    block: RawBlockPeople
): Generator<string, void, undefined> {
    yield "[.+people]"
    if (typeof block.value !== "string") {
        for (const b of block.value) {
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        }
    }
    yield "[]"
}

function* rawBlockPeopleRowsToArchieMLString(
    block: RawBlockPeopleRows
): Generator<string, void, undefined> {
    yield "{.people-rows}"
    yield* propertyToArchieMLString("columns", block.value)
    yield "[.+people]"
    if (typeof block.value.people !== "string") {
        for (const person of block.value.people) {
            yield* OwidRawGdocBlockToArchieMLStringGenerator(person)
        }
    }
    yield "[]"
    yield "{}"
}

function* rawBlockPersonToArchieMLString(
    block: RawBlockPerson
): Generator<string, void, undefined> {
    yield "{.person}"
    yield* propertyToArchieMLString("image", block.value)
    yield* propertyToArchieMLString("name", block.value)
    yield* propertyToArchieMLString("title", block.value)
    yield* propertyToArchieMLString("url", block.value)
    yield "[.+text]"
    for (const b of block.value.text) {
        yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
    }
    yield "[]"
    if (block.value.socials?.length) {
        yield "[.socials]"
        for (const b of block.value.socials) {
            yield* propertyToArchieMLString("type", b)
            yield* propertyToArchieMLString("url", b)
            yield* propertyToArchieMLString("text", b)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockPullQuoteToArchieMLString(
    block: RawBlockPullQuote
): Generator<string, void, undefined> {
    yield "{.pull-quote}"
    yield* propertyToArchieMLString("quote", block.value)
    yield* propertyToArchieMLString("align", block.value)
    yield "[.+content]"
    if (block.value.content) {
        for (const content of block.value.content) {
            yield* OwidRawGdocBlockToArchieMLStringGenerator(content)
        }
    }
    yield "[]"

    yield "{}"
}

function* rawBlockHorizontalRuleToArchieMLString(
    _block: RawBlockHorizontalRule
): Generator<string, void, undefined> {
    yield "{.horizontal-rule}"
    yield "{}"
}

function* rawBlockRecircToArchieMLString(
    block: RawBlockRecirc
): Generator<string, void, undefined> {
    yield "{.recirc}"
    if (block.value) {
        yield* propertyToArchieMLString("title", block.value)
        yield* propertyToArchieMLString("align", block.value)
        const links = block.value.links
        if (links) {
            yield "[.links]"
            for (const link of links) {
                yield* propertyToArchieMLString("url", link)
                yield* propertyToArchieMLString("title", link)
                yield* propertyToArchieMLString("subtitle", link)
            }
            yield "[]"
        }
    }
    yield "{}"
}

function escapeRawText(text: string): string {
    // In ArchieML, single words followed by a colon are interpreted as a key-value pair. Since here
    // we are trying to output raw text, we need to escape colons.
    return text.replace(/^\s*(\w+)\s*:/m, "$1\\:")
}

function* rawBlockTextToArchieMLString(
    block: RawBlockText
): Generator<string, void, undefined> {
    yield escapeRawText(block.value)
}

function* rawBlockHtmlToArchieMLString(
    block: RawBlockHtml
): Generator<string, void, undefined> {
    if (block.value !== undefined) {
        // When creating Gdocs we need a straightforward way to detect if we
        // are inside an html block so we *don't* parse Html tags in there (as
        // this would remove the tags). We make this easier by writing html
        // tags as properties that are always serialized as multiline properites
        // with an ":end" marker, even if the content is a single line.
        yield `html: ${escapeRawText(block.value)}`
        yield `:end`
    }
}

function* rawBlockUrlToArchieMLString(
    block: RawBlockUrl
): Generator<string, void, undefined> {
    yield keyValueToArchieMlString("url", block.value)
}

function* rawBlockPositionToArchieMLString(
    block: RawBlockPosition
): Generator<string, void, undefined> {
    yield keyValueToArchieMlString("position", block.value)
}

function* RawBlockHeadingToArchieMLString(
    block: RawBlockHeading
): Generator<string, void, undefined> {
    yield "{.heading}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("text", block.value)
        yield* propertyToArchieMLString("level", block.value)
    }
    yield "{}"
}

function* rawBlockSDGGridToArchieMLString(
    block: RawBlockSDGGrid
): Generator<string, void, undefined> {
    yield "[.sdg-grid]"
    if (typeof block.value !== "string") {
        for (const item of block.value) {
            yield* propertyToArchieMLString("goal", item)
            yield* propertyToArchieMLString("link", item)
        }
    }
    yield "[]"
}

function* RawBlockStickyRightContainerToArchieMLString(
    block: RawBlockStickyRightContainer
): Generator<string, void, undefined> {
    yield "{ .sticky-right }"
    if (typeof block.value !== "string") {
        yield "[.+right]"
        for (const b of block.value.right)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        yield "[]"
        yield "[.+left]"
        for (const b of block.value.left)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        yield "[]"
    }
    yield "{}"
}

function* RawBlockStickyLeftContainerToArchieMLString(
    block: RawBlockStickyLeftContainer
): Generator<string, void, undefined> {
    yield "{ .sticky-left }"
    if (typeof block.value !== "string") {
        yield "[.+right]"
        for (const b of block.value.right)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        yield "[]"
        yield "[.+left]"
        for (const b of block.value.left)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        yield "[]"
    }
    yield "{}"
}

function* RawBlockSideBySideContainerToArchieMLString(
    block: RawBlockSideBySideContainer
): Generator<string, void, undefined> {
    yield "{ .side-by-side }"
    if (typeof block.value !== "string") {
        yield "[.+right]"
        for (const b of block.value.right)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        yield "[]"
        yield "[.+left]"
        for (const b of block.value.left)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        yield "[]"
    }
    yield "{}"
}

function* RawBlockGraySectionToArchieMLString(
    block: RawBlockGraySection
): Generator<string, void, undefined> {
    yield "[.+gray-section]"
    if (typeof block.value !== "string") {
        for (const b of block.value)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
    }
    yield "[]"
}

function* RawBlockProminentLinkToArchieMLString(
    block: RawBlockProminentLink
): Generator<string, void, undefined> {
    yield "{.prominent-link}"
    yield* propertyToArchieMLString("url", block.value)
    yield* propertyToArchieMLString("title", block.value)
    yield* propertyToArchieMLString("description", block.value)
    yield* propertyToArchieMLString("thumbnail", block.value)
    yield "{}"
}

function* rawBlockSDGTocToArchieMLString(): Generator<string, void, undefined> {
    yield "{.sdg-toc}"
    yield "{}"
}

function* rawBlockMissingDataToArchieMLString(): Generator<
    string,
    void,
    undefined
> {
    yield "{.missing-data}"
    yield "{}"
}

function* rawBlockAdditionalChartsToArchieMLString(
    block: RawBlockAdditionalCharts
): Generator<string, void, undefined> {
    yield "{.additional-charts}"
    if (block.value.list) {
        yield* listToArchieMLString(block.value.list, "list")
    }
    yield "{}"
}

function* RawBlockExpandableParagraphToArchieMLString(
    block: RawBlockExpandableParagraph
): Generator<string, void, undefined> {
    yield "[.+expandable-paragraph]"
    if (typeof block.value !== "string") {
        for (const b of block.value)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
    }
    yield "[]"
}

function* rawBlockExpanderToArchieMLString(
    block: RawBlockExpander
): Generator<string, void, undefined> {
    yield "{.expander}"
    yield* propertyToArchieMLString("title", block.value)
    yield* propertyToArchieMLString("subtitle", block.value)
    yield* propertyToArchieMLString("heading", block.value)
    yield "[.+content]"
    if (block.value.content) {
        for (const b of block.value.content) {
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        }
    }
    yield "[]"
    yield "{}"
}

function* rawBlockAllChartsToArchieMLString(
    block: RawBlockAllCharts
): Generator<string, void, undefined> {
    yield "{.all-charts}"
    yield* propertyToArchieMLString("heading", block.value)
    if (block.value.top) {
        yield "[.top]"
        for (const item of block.value.top) {
            yield* propertyToArchieMLString("url", item)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockTopicPageIntroToArchieMLString(
    block: RawBlockTopicPageIntro
): Generator<string, void, undefined> {
    yield "{.topic-page-intro}"
    yield "[.+content]"
    for (const content of block.value.content) {
        yield* OwidRawGdocBlockToArchieMLStringGenerator(content)
    }
    yield "[]"
    const downloadButton = block.value["download-button"]
    if (downloadButton) {
        yield "{.download-button}"
        yield* propertyToArchieMLString("text", downloadButton)
        yield* propertyToArchieMLString("url", downloadButton)
        yield "{}"
    }
    const relatedTopics = block.value["related-topics"]
    if (relatedTopics && relatedTopics.length) {
        yield "[.related-topics]"
        for (const relatedTopic of relatedTopics) {
            yield* propertyToArchieMLString("text", relatedTopic)
            yield* propertyToArchieMLString("url", relatedTopic)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockCookieNoticeToArchieMLString(
    _: RawBlockCookieNotice
): Generator<string, void, undefined> {
    yield "{.cookie-notice}"
    yield "{}"
}

function* rawKeyInsightsToArchieMLString(
    block: RawBlockKeyInsights
): Generator<string, void, undefined> {
    yield "{.key-insights}"
    yield* propertyToArchieMLString("heading", block.value)
    if (block.value.insights) {
        yield "[.insights]"
        for (const insight of block.value.insights) {
            yield* propertyToArchieMLString("title", insight)
            yield* propertyToArchieMLString("filename", insight)
            yield* propertyToArchieMLString("url", insight)
            yield* propertyToArchieMLString("narrativeChartName", insight)
            if (insight.content) {
                yield "[.+content]"
                for (const content of insight.content) {
                    yield* OwidRawGdocBlockToArchieMLStringGenerator(content)
                }
                yield "[]"
            }
        }
        yield "[]"
    }
    yield "{}"
}

function* rawResearchAndWritingToArchieMLString(
    block: RawBlockResearchAndWriting
): Generator<string, void, undefined> {
    const { primary, secondary, more, latest, rows } = block.value
    function* rawLinkToArchie(
        link: RawBlockResearchAndWritingLink
    ): Generator<string, void, undefined> {
        yield* propertyToArchieMLString("url", link)
        yield* propertyToArchieMLString("authors", link)
        yield* propertyToArchieMLString("title", link)
        yield* propertyToArchieMLString("subtitle", link)
        yield* propertyToArchieMLString("filename", link)
    }
    yield "{.research-and-writing}"
    yield* propertyToArchieMLString("heading", block.value)
    yield* propertyToArchieMLString("hide-authors", block.value)
    if (primary) {
        yield "[.primary]"
        if (_.isArray(primary)) {
            for (const link of primary) {
                yield* rawLinkToArchie(link)
            }
        } else {
            yield* rawLinkToArchie(primary)
        }
        yield "[]"
    }
    if (secondary) {
        yield "[.secondary]"
        if (_.isArray(secondary)) {
            for (const link of secondary) {
                yield* rawLinkToArchie(link)
            }
        } else {
            yield* rawLinkToArchie(secondary)
        }
        yield "[]"
    }
    if (more) {
        yield "{.more}"
        yield* propertyToArchieMLString("heading", more)
        if (more.articles) {
            yield "[.articles]"
            for (const link of more.articles) {
                yield* rawLinkToArchie(link)
            }
            yield "[]"
        }
        yield "{}"
    }
    if (latest) {
        yield "{.latest}"
        yield* propertyToArchieMLString("heading", latest)
        yield "{}"
    }
    if (rows) {
        yield "[.rows]"
        for (const row of rows) {
            yield* propertyToArchieMLString("heading", row)
            if (row.articles) {
                yield "[.articles]"
                for (const link of row.articles) {
                    yield* rawLinkToArchie(link)
                }
                yield "[]"
            }
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockAlignToArchieMLString(
    block: RawBlockAlign
): Generator<string, void, undefined> {
    yield "{.align}"
    yield* propertyToArchieMLString("alignment", block.value)

    yield "[.+content]"
    for (const content of block.value.content) {
        yield* OwidRawGdocBlockToArchieMLStringGenerator(content)
    }
    yield "[]"
    yield "{}"
}

function* rawBlockEntrySummaryToArchieMLString(
    block: RawBlockEntrySummary
): Generator<string, void, undefined> {
    yield "{.entry-summary}"
    yield "[.items]"
    if (block.value.items) {
        for (const item of block.value.items) {
            yield* propertyToArchieMLString("text", item)
            yield* propertyToArchieMLString("slug", item)
        }
    }
    yield "[]"
    yield "{}"
}

function* rawBlockRowToArchieMLString(
    row: RawBlockTableRow
): Generator<string, void, undefined> {
    yield "{.table-row}"
    const cells = row.value.cells
    if (cells) {
        yield "[.+cells]"
        for (const cell of cells) {
            const content = cell.value
            yield "[.+table-cell]"
            if (content) {
                for (const rawBlock of content)
                    yield* OwidRawGdocBlockToArchieMLStringGenerator(rawBlock)
            }
            yield "[]"
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockExplorerTilesToArchieMLString(
    block: RawBlockExplorerTiles
): Generator<string, void, undefined> {
    yield "{.explorer-tiles}"
    yield* propertyToArchieMLString("title", block.value)
    yield* propertyToArchieMLString("subtitle", block.value)
    if (block.value.explorers) {
        yield "[.explorers]"
        for (const explorer of block.value.explorers) {
            yield* propertyToArchieMLString("url", explorer)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockBlockquoteToArchieMLString(
    blockquote: RawBlockBlockquote
): Generator<string, void, undefined> {
    yield "{.blockquote}"
    yield* propertyToArchieMLString("citation", blockquote.value)
    if (blockquote.value.text) {
        yield "[.+text]"
        for (const textBlock of blockquote.value.text) {
            yield* OwidRawGdocBlockToArchieMLStringGenerator(textBlock)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockTableToArchieMLString(
    block: RawBlockTable
): Generator<string, void, undefined> {
    yield "{.table}"
    yield* propertyToArchieMLString("template", block.value)
    yield* propertyToArchieMLString("size", block.value)
    const rows = block?.value?.rows
    if (rows) {
        yield "[.+rows]"
        for (const row of rows) {
            yield* rawBlockRowToArchieMLString(row)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockKeyIndicatorToArchieMLString(
    block: RawBlockKeyIndicator
): Generator<string, void, undefined> {
    yield "{.key-indicator}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("datapageUrl", block.value)
        yield* propertyToArchieMLString("title", block.value)
        yield* propertyToArchieMLString("source", block.value)
        if (block.value.text) {
            yield "[.+text]"
            for (const textBlock of block.value.text) {
                yield* OwidRawGdocBlockToArchieMLStringGenerator(textBlock)
            }
            yield "[]"
        }
    }
    yield "{}"
}

function* rawBlockPillRowToArchieMLString(
    block: RawBlockPillRow
): Generator<string, void, undefined> {
    yield "{.pill-row}"
    yield* propertyToArchieMLString("title", block.value)
    const pills = block?.value?.pills
    if (pills) {
        yield "[.pills]"
        for (const pill of pills) {
            yield* propertyToArchieMLString("text", pill)
            yield* propertyToArchieMLString("url", pill)
        }
        yield "[]"
    }
    yield "{}"
}

function* rawBlockKeyIndicatorCollectionToArchieMLString(
    block: RawBlockKeyIndicatorCollection
): Generator<string, void, undefined> {
    yield "{.key-indicator-collection}"
    if (typeof block.value.indicators !== "string") {
        yield "[.+indicators]"
        for (const b of block.value.indicators) {
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
        }
        yield "[]"
    }
    yield "{}"
}

function* RawBlockLatestDataInsightsToArchieMLString(
    _: RawBlockLatestDataInsights
): Generator<string, void, undefined> {
    yield "{.latest-data-insights}"
    yield "{}"
}

function* rawBlockHomepageSearchToArchieMLString(
    _: RawBlockHomepageSearch
): Generator<string, void, undefined> {
    yield "{.homepage-search}"
    yield "{}"
}

function* rawBlockHomepageIntroToArchieMLString(
    block: RawBlockHomepageIntro
): Generator<string, void, undefined> {
    yield "{.homepage-intro}"
    yield "[.+featured-work]"
    if (block.value?.["featured-work"]) {
        for (const post of block.value["featured-work"]) {
            const value = post.value
            yield `{.${post.type}}`
            yield* propertyToArchieMLString("title", value)
            yield* propertyToArchieMLString("description", value)
            yield* propertyToArchieMLString("url", value)
            yield* propertyToArchieMLString("filename", value)
            yield* propertyToArchieMLString("kicker", value)
            yield* propertyToArchieMLString("authors", value)
            yield* propertyToArchieMLString("isNew", value)
            yield "{}"
        }
    }
    yield "[]"
    yield "{}"
}

function* rawBlockSocialsToArchieMLString(
    block: RawBlockSocials
): Generator<string, void, undefined> {
    yield "[.socials]"
    if (typeof block.value !== "string") {
        for (const link of block.value) {
            yield* propertyToArchieMLString("text", link)
            yield* propertyToArchieMLString("url", link)
            yield* propertyToArchieMLString("type", link)
        }
    }
    yield "[]"
}

export function* OwidRawGdocBlockToArchieMLStringGenerator(
    block: OwidRawGdocBlock | RawBlockTableRow
): Generator<string, void, undefined> {
    const content = match(block)
        .with(
            { type: "additional-charts" },
            rawBlockAdditionalChartsToArchieMLString
        )
        .with({ type: "all-charts" }, rawBlockAllChartsToArchieMLString)
        .with({ type: "aside" }, rawBlockAsideToArchieMLString)
        .with({ type: "chart" }, rawBlockChartToArchieMLString)
        .with({ type: "expander" }, rawBlockExpanderToArchieMLString)
        .with(
            { type: "narrative-chart" },
            rawBlockNarrativeChartToArchieMLString
        )
        .with({ type: "code" }, rawBlockCodeToArchieMLString)
        .with({ type: "donors" }, rawBlockDonorListToArchieMLString)
        .with({ type: "scroller" }, rawBlockScrollerToArchieMLString)
        .with({ type: "callout" }, rawBlockCalloutToArchieMLString)
        .with({ type: "chart-story" }, rawBlockChartStoryToArchieMLString)
        .with({ type: "image" }, rawBlockImageToArchieMLString)
        .with({ type: "video" }, rawBlockVideoToArchieMLString)
        .with({ type: "list" }, rawBlockListToArchieMLString)
        .with({ type: "numbered-list" }, rawBlockNumberedListToArchieMLString)
        .with({ type: "people" }, rawBlockPeopleToArchieMLString)
        .with({ type: "people-rows" }, rawBlockPeopleRowsToArchieMLString)
        .with({ type: "person" }, rawBlockPersonToArchieMLString)
        .with({ type: "pull-quote" }, rawBlockPullQuoteToArchieMLString)
        .with(
            { type: "horizontal-rule" },
            rawBlockHorizontalRuleToArchieMLString
        )
        .with({ type: "recirc" }, rawBlockRecircToArchieMLString)
        .with({ type: "text" }, rawBlockTextToArchieMLString)
        .with({ type: "html" }, rawBlockHtmlToArchieMLString)
        .with({ type: "url" }, rawBlockUrlToArchieMLString)
        .with({ type: "position" }, rawBlockPositionToArchieMLString)
        .with({ type: "heading" }, RawBlockHeadingToArchieMLString)
        .with({ type: "sdg-grid" }, rawBlockSDGGridToArchieMLString)
        .with(
            { type: "sticky-right" },
            RawBlockStickyRightContainerToArchieMLString
        )
        .with(
            { type: "sticky-left" },
            RawBlockStickyLeftContainerToArchieMLString
        )
        .with(
            { type: "side-by-side" },
            RawBlockSideBySideContainerToArchieMLString
        )
        .with({ type: "gray-section" }, RawBlockGraySectionToArchieMLString)
        .with({ type: "prominent-link" }, RawBlockProminentLinkToArchieMLString)
        .with({ type: "sdg-toc" }, rawBlockSDGTocToArchieMLString)
        .with({ type: "missing-data" }, rawBlockMissingDataToArchieMLString)
        .with(
            { type: "expandable-paragraph" },
            RawBlockExpandableParagraphToArchieMLString
        )
        .with(
            { type: "topic-page-intro" },
            rawBlockTopicPageIntroToArchieMLString
        )
        .with({ type: "cookie-notice" }, rawBlockCookieNoticeToArchieMLString)
        .with({ type: "key-insights" }, rawKeyInsightsToArchieMLString)
        .with(
            { type: "research-and-writing" },
            rawResearchAndWritingToArchieMLString
        )
        .with({ type: "align" }, rawBlockAlignToArchieMLString)
        .with({ type: "entry-summary" }, rawBlockEntrySummaryToArchieMLString)
        .with({ type: "table" }, rawBlockTableToArchieMLString)
        .with({ type: "table-row" }, rawBlockRowToArchieMLString)
        .with({ type: "explorer-tiles" }, rawBlockExplorerTilesToArchieMLString)
        .with({ type: "blockquote" }, rawBlockBlockquoteToArchieMLString)
        .with({ type: "key-indicator" }, rawBlockKeyIndicatorToArchieMLString)
        .with(
            { type: "key-indicator-collection" },
            rawBlockKeyIndicatorCollectionToArchieMLString
        )
        .with({ type: "pill-row" }, rawBlockPillRowToArchieMLString)
        .with(
            { type: "latest-data-insights" },
            RawBlockLatestDataInsightsToArchieMLString
        )
        .with(
            { type: "homepage-search" },
            rawBlockHomepageSearchToArchieMLString
        )
        .with({ type: "homepage-intro" }, rawBlockHomepageIntroToArchieMLString)
        .with({ type: "socials" }, rawBlockSocialsToArchieMLString)
        .exhaustive()
    yield* content
}

export function OwidRawGdocBlockToArchieMLString(
    block: OwidRawGdocBlock | RawBlockTableRow
): string {
    const lines = [...OwidRawGdocBlockToArchieMLStringGenerator(block)]
    return [...lines, ""].join("\n")
}
