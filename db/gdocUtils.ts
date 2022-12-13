import {
    OwidRawArticleBlock,
    Span,
    RawBlockHeading,
    EnrichedBlockText,
    OwidEnrichedArticleBlock,
    SpanLink,
    SpanBold,
    SpanItalic,
    SpanFallback,
    SpanQuote,
    SpanSuperscript,
    SpanSubscript,
    SpanUnderline,
    RawBlockRecirc,
    EnrichedBlockSimpleText,
    SpanSimpleText,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockFixedGraphic,
    RawBlockGreySection,
    RawBlockHorizontalRule,
    RawBlockHtml,
    RawBlockImage,
    RawBlockList,
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
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { partition, compact } from "lodash"
import * as cheerio from "cheerio"

function appendDotEndIfMultiline(line: string): string {
    if (line.includes("\n")) return line + "\n.end"
    return line
}

export function keyValueToArchieMlString(
    key: string,
    val: string | undefined
): string {
    if (val !== undefined) return `${key}: ${appendDotEndIfMultiline(val)}`
    return ""
}

// The Record<string, any> here is not ideal - it would be nicer to
// restrict the field type to string but then it only works if all
// fields are strings. Maybe there is some TS magic to do this?
function* propertyToArchieMLString<T extends Record<string, any>>(
    key: keyof T,
    value: T | undefined
): Generator<string, void, undefined> {
    if (value !== undefined)
        if (typeof value === "string") {
            // This is a case where the user gave a string value instead of an object
            // We assume that this was an error here. Not handling this here would make
            // the serialization code below more complex.
        } else yield `${key}: ${appendDotEndIfMultiline(value[key])}`
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
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
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
            yield* item.technical || []
        }
    }
    yield "[]"
}

function* rawBlockFixedGraphicToArchieMLString(
    block: RawBlockFixedGraphic
): Generator<string, void, undefined> {
    yield "[.+fixed-graphic]"
    if (typeof block.value !== "string") {
        for (const b of block.value)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
    }
    yield "[]"
}

function* rawBlockImageToArchieMLString(
    block: RawBlockImage
): Generator<string, void, undefined> {
    yield "{.image}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("src", block.value)
        yield* propertyToArchieMLString("caption", block.value)
    }
    yield "{}"
}

function* rawBlockListToArchieMLString(
    block: RawBlockList
): Generator<string, void, undefined> {
    yield "[.list]"
    if (typeof block.value !== "string") yield* block.value
    yield "[]"
}

function* rawBlockPullQuoteToArchieMLString(
    block: RawBlockPullQuote
): Generator<string, void, undefined> {
    yield "[.+pull-quote]"
    if (typeof block.value !== "string")
        for (const b of block.value)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
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
    yield "[.recirc]"
    if (typeof block.value !== "string") {
        for (const item of block.value) {
            yield* propertyToArchieMLString("title", item)
            if (item.list) {
                yield "[.list]"
                for (const subItem of item.list) {
                    yield* propertyToArchieMLString("author", subItem)
                    yield* propertyToArchieMLString("url", subItem)
                }
                yield "[]"
            }
        }
    }
    yield "[]"
}

function escapeRawText(text: string): string {
    // In ArchieML, single words followed by a colon are interpreted as a key-value pair. Since here
    // we are trying to output raw text, we need to escape colons.
    return text.replace(/^\s*(\w+)\s*:/, "$1\\:")
}

function* rawBlockTextToArchieMLString(
    block: RawBlockText
): Generator<string, void, undefined> {
    yield escapeRawText(block.value)
}

function* rawBlockHtmlToArchieMLString(
    block: RawBlockHtml
): Generator<string, void, undefined> {
    yield escapeRawText(block.value)
}

function* rawBlockUrlToArchieMLString(
    block: RawBlockUrl
): Generator<string, void, undefined> {
    yield keyValueToArchieMlString("url", block.value)
}

function* rawBlockPositionToArchieMLString(
    block: RawBlockPosition
): Generator<string, void, undefined> {
    yield keyValueToArchieMlString("url", block.value)
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
        yield "[+right]"
        for (const b of block.value.right)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
        yield "[]"
        yield "[+left]"
        for (const b of block.value.left)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
        yield "[]"
    }
    yield "{}"
}

function* RawBlockStickyLeftContainerToArchieMLString(
    block: RawBlockStickyLeftContainer
): Generator<string, void, undefined> {
    yield "{ .sticky-left }"
    if (typeof block.value !== "string") {
        yield "[+right]"
        for (const b of block.value.right)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
        yield "[]"
        yield "[+left]"
        for (const b of block.value.left)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
        yield "[]"
    }
    yield "{}"
}

function* RawBlockSideBySideContainerToArchieMLString(
    block: RawBlockSideBySideContainer
): Generator<string, void, undefined> {
    yield "{ .side-by-side }"
    if (typeof block.value !== "string") {
        yield "[+right]"
        for (const b of block.value.right)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
        yield "[]"
        yield "[+left]"
        for (const b of block.value.left)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
        yield "[]"
    }
    yield "{}"
}

function* RawBlockGreySectionToArchieMLString(
    block: RawBlockGreySection
): Generator<string, void, undefined> {
    yield "[+grey-section]"
    if (typeof block.value !== "string") {
        for (const b of block.value)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
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

function* owidRawArticleBlockToArchieMLStringGenerator(
    block: OwidRawArticleBlock
): Generator<string, void, undefined> {
    const content = match(block)
        .with({ type: "aside" }, rawBlockAsideToArchieMLString)
        .with({ type: "chart" }, rawBlockChartToArchieMLString)
        .with({ type: "scroller" }, rawBlockScrollerToArchieMLString)
        .with({ type: "chart-story" }, rawBlockChartStoryToArchieMLString)
        .with({ type: "fixed-graphic" }, rawBlockFixedGraphicToArchieMLString)
        .with({ type: "image" }, rawBlockImageToArchieMLString)
        .with({ type: "list" }, rawBlockListToArchieMLString)
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
        .with({ type: "grey-section" }, RawBlockGreySectionToArchieMLString)
        .with({ type: "prominent-link" }, RawBlockProminentLinkToArchieMLString)
        .with({ type: "sdg-toc" }, rawBlockSDGTocToArchieMLString)
        .with({ type: "missing-data" }, rawBlockMissingDataToArchieMLString)
        .exhaustive()
    yield* content
}

export function owidRawArticleBlockToArchieMLString(
    block: OwidRawArticleBlock
): string {
    return [...owidRawArticleBlockToArchieMLStringGenerator(block), ""].join(
        "\n"
    )
}
export function consolidateSpans(
    blocks: OwidEnrichedArticleBlock[]
): OwidEnrichedArticleBlock[] {
    const newBlocks: OwidEnrichedArticleBlock[] = []
    let currentBlock: EnrichedBlockText | undefined = undefined
    for (const block of blocks) {
        if (block.type === "text")
            if (currentBlock === undefined) currentBlock = block
            else
                currentBlock = {
                    type: "text",
                    value: [...currentBlock.value, ...block.value],
                    parseErrors: [],
                }
        else {
            if (currentBlock !== undefined) {
                newBlocks.push(currentBlock)
                currentBlock = undefined
                newBlocks.push(block)
            }
        }
    }
    return newBlocks
}

export function spanToHtmlString(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with(
            { spanType: "span-link" },
            (span) =>
                `<a href="${span.url}">${spansToHtmlString(span.children)}</a>`
        )
        .with({ spanType: "span-newline" }, () => "</br>")
        .with(
            { spanType: "span-italic" },
            (span) => `<i>${spansToHtmlString(span.children)}</i>`
        )
        .with(
            { spanType: "span-bold" },
            (span) => `<b>${spansToHtmlString(span.children)}</b>`
        )
        .with(
            { spanType: "span-underline" },
            (span) => `<u>${spansToHtmlString(span.children)}</u>`
        )
        .with(
            { spanType: "span-subscript" },
            (span) => `<sub>${spansToHtmlString(span.children)}</sub>`
        )
        .with(
            { spanType: "span-superscript" },
            (span) => `<sup>${spansToHtmlString(span.children)}</sup>`
        )
        .with(
            { spanType: "span-quote" },
            (span) => `<q>${spansToHtmlString(span.children)}</q>`
        )
        .with(
            { spanType: "span-fallback" },
            (span) => `<span>${spansToHtmlString(span.children)}</span>`
        )
        .exhaustive()
}

export function spansToHtmlString(spans: Span[]): string {
    if (spans.length === 0) return ""
    else {
        const result = spans.map(spanToHtmlString).join("")
        return result
    }
}

function spanFallback(node: CheerioElement): SpanFallback {
    return {
        spanType: "span-fallback",
        children: compact(node.children?.map(cheerioToSpan)) ?? [],
    }
}

export function htmlToEnrichedTextBlock(html: string): EnrichedBlockText {
    return {
        type: "text",
        value: htmlToSpans(html),
        parseErrors: [],
    }
}

export function htmlToSimpleTextBlock(html: string): EnrichedBlockSimpleText {
    const spans = htmlToSpans(html)
    const [simpleTextSpans, otherSpans] = partition(
        spans,
        (s) => s.spanType === "span-simple-text"
    )
    const simpleText: SpanSimpleText = {
        spanType: "span-simple-text",
        text: simpleTextSpans.map((s) => (s as SpanSimpleText).text).join(" "),
    }
    const parseErrors =
        otherSpans.length > 0
            ? [
                  {
                      message:
                          "Formatted text fragments found in simple text block",
                  },
              ]
            : []
    return {
        type: "simple-text",
        value: simpleText,
        parseErrors: parseErrors,
    }
}

interface SpanTrackingContext {
    onlyWhitespaceSoFar: boolean
    stringToPrepend: string
}

/** Removes the styles of leading non-word spans. This is necessary because
    we may get a string like " this is a string" that should be a link but
    then we don't want to render the link styling string with the leading
    space.

    This function modifies the spans in place in case they are leading whitespace
    spans and returns a cpy of the passed context filled with the result of the
    operation.

    Note that it is important to collect the whitespace we find and return it
    so that a new simple-text span can be added at the beginning (the textual
    content of the resulting text must be the same as it was; we are deleting
    whitespace spans here so the WS must be collected and returned)
 */
function removeStylesOfLeadingNonwordSpansRecursive(
    spans: Span[],
    context: SpanTrackingContext
): SpanTrackingContext {
    const updatedContext = { ...context }
    // Iterate over the spans while we find only whitespace
    for (
        let spanIndex = 0;
        spanIndex < spans.length && updatedContext.onlyWhitespaceSoFar;
        spanIndex++
    ) {
        const currentSpan = spans[spanIndex]
        match(currentSpan)
            .with({ spanType: "span-simple-text" }, (span) => {
                // if we find a simple-text span, check if it is only
                // or partially whitespace. Collect the whitespace
                // so we can return it.
                const trimmed = span.text.trimStart()
                if (trimmed.length === 0) {
                    updatedContext.stringToPrepend += span.text
                    spans.splice(spanIndex, 1)
                    spanIndex-- // need to adjust the index because we removed an element and iterating forward
                } else {
                    if (trimmed.length < span.text.length) {
                        updatedContext.stringToPrepend += span.text.slice(
                            0,
                            span.text.length - trimmed.length
                        )
                        span.text = trimmed
                    }
                    updatedContext.onlyWhitespaceSoFar = false
                }
            })
            .with({ spanType: "span-newline" }, () => {})
            .with(
                {
                    spanType: P.union(
                        "span-link",
                        "span-italic",
                        "span-bold",
                        "span-underline",
                        "span-subscript",
                        "span-superscript",
                        "span-quote",
                        "span-fallback"
                    ),
                },
                (span) => {
                    // If this is a span with children, recurse into them
                    // and collect the whitespace we find
                    const childrenContext =
                        removeStylesOfLeadingNonwordSpansRecursive(
                            span.children,
                            { onlyWhitespaceSoFar: true, stringToPrepend: "" }
                        )
                    updatedContext.stringToPrepend +=
                        childrenContext.stringToPrepend
                    updatedContext.onlyWhitespaceSoFar =
                        childrenContext.onlyWhitespaceSoFar
                    if (updatedContext.onlyWhitespaceSoFar) {
                        spans.splice(spanIndex, 1)
                        spanIndex-- // need to adjust the index because we removed an element and iterating forward
                    }
                }
            )
            .exhaustive()
    }
    return updatedContext
}

/** Removes the styles of leading non-word spans. This is necessary because
    we may get a string like " this is a string" that should be a link but
    then we don't want to render the link styling string with the leading
    space.

    This function modifies the spans in place in case they are leading whitespace
    spans and returns a cpy of the passed context filled with the result of the
    operation.

    Note that it is important to collect the whitespace we find and return it
    so that a new simple-text span can be added at the beginning (the textual
    content of the resulting text must be the same as it was; we are deleting
    whitespace spans here so the WS must be collected and returned)
 */
function removeStylesOTrailingNonwordSpansRecursive(
    spans: Span[],
    context: SpanTrackingContext
): SpanTrackingContext {
    const updatedContext = { ...context }
    // Iterate over the spans while we find only whitespace. We iterate
    // backwards because we are removing training whitespace from the end
    for (
        let spanIndex = spans.length - 1;
        spanIndex >= 0 && updatedContext.onlyWhitespaceSoFar;
        spanIndex--
    ) {
        const currentSpan = spans[spanIndex]
        match(currentSpan)
            .with({ spanType: "span-simple-text" }, (span) => {
                // if we find a simple-text span, check if it is only
                // or partially whitespace. Collect the whitespace
                // so we can return it.
                const trimmed = span.text.trimEnd()
                if (trimmed.length === 0) {
                    updatedContext.stringToPrepend += span.text
                    spans.splice(spanIndex, 1)
                } else {
                    if (trimmed.length < span.text.length) {
                        updatedContext.stringToPrepend =
                            span.text.slice(trimmed.length) +
                            updatedContext.stringToPrepend
                        span.text = trimmed
                        // no need to adjust the index here as we are removing at the end
                    }
                    updatedContext.onlyWhitespaceSoFar = false
                }
            })
            .with({ spanType: "span-newline" }, () => {})
            .with(
                {
                    spanType: P.union(
                        "span-link",
                        "span-italic",
                        "span-bold",
                        "span-underline",
                        "span-subscript",
                        "span-superscript",
                        "span-quote",
                        "span-fallback"
                    ),
                },
                (span) => {
                    const childrenContext =
                        removeStylesOTrailingNonwordSpansRecursive(
                            span.children,
                            { onlyWhitespaceSoFar: true, stringToPrepend: "" }
                        )
                    updatedContext.stringToPrepend +=
                        childrenContext.stringToPrepend
                    updatedContext.onlyWhitespaceSoFar =
                        childrenContext.onlyWhitespaceSoFar
                    if (updatedContext.onlyWhitespaceSoFar) {
                        spans.splice(spanIndex, 1)
                        // no need to adjust the index here as we are removing at the end
                    }
                }
            )
            .exhaustive()
    }
    return updatedContext
}

/** This function removes the styles of leading and trailing non-word spans.
    This is necessary because we may get a string like " this is a string" that
    should be a link but then we don't want to render the link styling string
    with the leading space (or the same for trailing space).
 */
export function removeStylesOfLeadingTrackingNonwordSpans(
    spans: Span[]
): Span[] {
    const spansCopy = [...spans]
    const leadingRemovedContext = removeStylesOfLeadingNonwordSpansRecursive(
        spansCopy,
        { onlyWhitespaceSoFar: true, stringToPrepend: "" }
    )
    if (leadingRemovedContext.stringToPrepend.length > 0) {
        spansCopy.unshift({
            spanType: "span-simple-text",
            text: leadingRemovedContext.stringToPrepend,
        })
    }
    const trailingRemovedContext = removeStylesOTrailingNonwordSpansRecursive(
        spansCopy,
        { onlyWhitespaceSoFar: true, stringToPrepend: "" }
    )
    if (trailingRemovedContext.stringToPrepend.length > 0) {
        spansCopy.push({
            spanType: "span-simple-text",
            text: trailingRemovedContext.stringToPrepend,
        })
    }
    return spansCopy
}

export function htmlToSpans(html: string): Span[] {
    const $ = cheerio.load(html)
    const nodes = $("body").contents().toArray()
    const spans = compact(nodes.map(cheerioToSpan)) ?? []
    // here we go through each top level span that we created and pull out the leading and trailing whitespace
    // (either standalone simple-text spans or spans that contain leading whitespace if at the beginning or
    // trailing whitespace if at the end). "Pull out" means that we convert these whitespace characters to a
    // standalone simple-text span and remove the whitespace from the span that contained it.
    return spans.flatMap((span) =>
        removeStylesOfLeadingTrackingNonwordSpans([span])
    )
}

// Sometimes Google automatically linkifies a URL.
// We always want the plaintext, not '<a href="www.ourworldindata.org">www.ourworldindata.org</a>'
export function extractPlaintextUrl(html: string = ""): string {
    if (html.trim().startsWith("http")) return html.trim()
    const $ = cheerio.load(html)
    return $("a").text()
}

export function cheerioToSpan(node: CheerioElement): Span | undefined {
    if (node.type === "text")
        // The regex replace takes care of the ArchieML escaping of :
        return {
            spanType: "span-simple-text",
            text: node.data?.replace(/\\:/g, ":") ?? "",
        }
    else if (node.type === "tag") {
        return match(node.tagName)
            .with("a", (): SpanLink => {
                const url = node.attribs.href
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-link", children, url }
            })
            .with("b", (): SpanBold => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("i", (): SpanItalic => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-italic", children }
            })
            .with("br", (): Span => ({ spanType: "span-newline" }))
            .with("cite", () => spanFallback(node))
            .with("code", () => spanFallback(node)) // TODO: should get a style
            .with(
                "em",
                (): SpanItalic => ({
                    spanType: "span-italic",
                    children: compact(node.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with(
                "q",
                (): SpanQuote => ({
                    spanType: "span-quote",
                    children: compact(node.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with("small", () => spanFallback(node))
            .with("span", () => spanFallback(node))
            .with("strong", (): SpanBold => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("sup", (): SpanSuperscript => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-superscript", children }
            })
            .with("sub", (): SpanSubscript => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-subscript", children }
            })
            .with("u", (): SpanUnderline => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-underline", children }
            })
            .with("wbr", () => spanFallback(node))
            .otherwise(() => {
                return undefined
            })
    }
    return undefined
}
