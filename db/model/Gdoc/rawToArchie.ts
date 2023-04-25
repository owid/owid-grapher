import {
    OwidRawGdocBlock,
    RawBlockHeading,
    RawBlockRecirc,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockGraySection,
    RawBlockHorizontalRule,
    RawBlockHtml,
    RawBlockImage,
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
    RawBlockCallout,
} from "@ourworldindata/utils"
import { RawBlockTopicPageIntro } from "@ourworldindata/utils/dist/owidTypes.js"
import { match } from "ts-pattern"

export function appendDotEndIfMultiline(
    line: string | null | undefined
): string {
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
            // TODO: we might need to reverse some regex sanitization here (e.g. colons?)
            if (item.technical) {
                yield* listToArchieMLString(item.technical, "technical")
            }
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
        for (const rawBlockText of block.value.text) {
            yield rawBlockText.value
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
        yield* propertyToArchieMLString("alt", block.value)
    }
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

function* rawBlockPullQuoteToArchieMLString(
    block: RawBlockPullQuote
): Generator<string, void, undefined> {
    yield "[.+pull-quote]"
    if (typeof block.value !== "string")
        for (const b of block.value)
            yield* OwidRawGdocBlockToArchieMLStringGenerator(b)
    yield "[]"
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
        const links = block.value.links
        if (links) {
            yield "[.links]"
            for (const link of links) {
                yield* propertyToArchieMLString("url", link)
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
    yield "[.additional-charts]"
    if (typeof block.value !== "string") {
        for (const listItem of block.value) {
            yield `* ${listItem}`
        }
    }
    yield "[]"
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

export function* OwidRawGdocBlockToArchieMLStringGenerator(
    block: OwidRawGdocBlock
): Generator<string, void, undefined> {
    const content = match(block)
        .with(
            { type: "additional-charts" },
            rawBlockAdditionalChartsToArchieMLString
        )
        .with({ type: "aside" }, rawBlockAsideToArchieMLString)
        .with({ type: "chart" }, rawBlockChartToArchieMLString)
        .with({ type: "scroller" }, rawBlockScrollerToArchieMLString)
        .with({ type: "callout" }, rawBlockCalloutToArchieMLString)
        .with({ type: "chart-story" }, rawBlockChartStoryToArchieMLString)
        .with({ type: "image" }, rawBlockImageToArchieMLString)
        .with({ type: "list" }, rawBlockListToArchieMLString)
        .with({ type: "numbered-list" }, rawBlockNumberedListToArchieMLString)
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
            { type: "topic-page-intro" },
            rawBlockTopicPageIntroToArchieMLString
        )
        .exhaustive()
    yield* content
}

export function OwidRawGdocBlockToArchieMLString(
    block: OwidRawGdocBlock
): string {
    const lines = [...OwidRawGdocBlockToArchieMLStringGenerator(block)]
    return [...lines, ""].join("\n")
}
