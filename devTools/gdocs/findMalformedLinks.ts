import {
    OwidEnrichedGdocBlock,
    Span,
    traverseEnrichedBlock,
} from "@ourworldindata/utils"
import { getPublishedGdocsWithTags, knexReadonlyTransaction } from "../../db/db"
import { gdocFromJSON } from "../../db/model/Gdoc/GdocFactory.js"

function collectAllSpanArrays(body: OwidEnrichedGdocBlock[]): Span[][] {
    const allSpanArrays: Span[][] = []

    // This callback will be executed for every block in the Gdoc.
    const blockCallback = (block: OwidEnrichedGdocBlock): void => {
        switch (block.type) {
            // Blocks with a single, required span array
            case "text":
                allSpanArrays.push(block.value)
                break
            case "aside":
                allSpanArrays.push(block.caption)
                break

            // Blocks with optional span arrays
            case "image":
            case "chart":
            case "narrative-chart":
            case "video":
                if (block.caption) {
                    allSpanArrays.push(block.caption)
                }
                break

            // Blocks with multiple span arrays
            case "heading":
                allSpanArrays.push(block.text)
                if (block.supertitle) {
                    allSpanArrays.push(block.supertitle)
                }
                break

            // Special case: An array of span arrays
            case "additional-charts":
                // The 'items' property is of type Span[][], so we spread it
                // to add all its inner arrays to our collection.
                allSpanArrays.push(...block.items)
                break

            // Blocks with an optional caption (their child blocks are
            // visited by `traverseEnrichedBlock`)
            case "static-viz":
            case "table":
                if (block.caption) {
                    allSpanArrays.push(block.caption)
                }
                break

            case "chart-rows":
                for (const row of block.rows) {
                    if (row.caption) {
                        allSpanArrays.push(row.caption)
                    }
                }
                break

            // Leaf blocks for `traverseEnrichedBlock`: it doesn't visit
            // their text blocks, so we collect their spans here
            case "chart-story":
                for (const item of block.items) {
                    allSpanArrays.push(item.narrative.value)
                    for (const technical of item.technical) {
                        allSpanArrays.push(technical.value)
                    }
                    if (item.chart.caption) {
                        allSpanArrays.push(item.chart.caption)
                    }
                }
                break
            case "pull-quote":
            case "topic-page-intro":
                for (const textBlock of block.content) {
                    allSpanArrays.push(textBlock.value)
                }
                break

            // Blocks that don't directly contain span arrays. Container blocks
            // like 'sticky-right', 'gray-section', 'callout', etc., are handled
            // by the `traverseEnrichedBlock` function, which will recursively
            // call this callback on their children.
            case "align":
            case "all-charts":
            case "bespoke-component":
            case "blockquote":
            case "callout":
            case "code":
            case "conditional-section":
            case "cookie-notice":
            case "country-profile-selector":
            case "cta":
            case "data-callout":
            case "data-callout-group":
            case "donors":
            case "expandable-paragraph":
            case "expander":
            case "explore-data-section":
            case "explorer-tiles":
            case "featured-data-insights":
            case "featured-metrics":
            case "gray-section":
            case "guided-chart":
            case "homepage-intro":
            case "homepage-search":
            case "horizontal-rule":
            case "html":
            case "key-indicator":
            case "key-indicator-collection":
            case "key-insights":
            case "latest-data-insights":
            case "list":
            case "ltp-toc":
            case "missing-data":
            case "numbered-list":
            case "people":
            case "people-rows":
            case "person":
            case "pill-row":
            case "prominent-link":
            case "pull-chart":
            case "recirc":
            case "research-and-writing":
            case "resource-panel":
            case "sdg-grid":
            case "sdg-toc":
            case "side-by-side":
            case "simple-text":
            case "socials":
            case "sticky-left":
            case "sticky-right":
            case "subscribe-banner":
                break
        }
    }

    // `traverseEnrichedBlock` only descends into the text blocks of callouts
    // and lists when a span callback is given, so we pass one that does nothing
    const ignoreSpan = (): void => undefined

    body.forEach((block) =>
        traverseEnrichedBlock(block, blockCallback, ignoreSpan)
    )

    return allSpanArrays
}

/**
 * Find gdocs that parsed formatted links incorrectly
 * this happened when a link was applied over a section of text that had formatted text within it
 * e.g. from the gdoc, <a href="url">text1 <b>bold text</b> text2</a>
 * would be formatted as
 * <a href="url">text1 </a><a href="url"><b>bold text</b></a><a href="url"> text2</a>
 */
async function main(): Promise<void> {
    await knexReadonlyTransaction(async (knex) => {
        const allPublishedGdocs = await getPublishedGdocsWithTags(knex).then(
            (rows) => rows.map(gdocFromJSON)
        )

        const malformedGdocs: typeof allPublishedGdocs = []

        for (const gdoc of allPublishedGdocs) {
            if (!gdoc.content.body) continue

            // 1. Collect all lists of spans from the entire document.
            const allSpanArrays = collectAllSpanArrays(gdoc.content.body)
            let issueFound = false

            // 2. Iterate through each list and perform the adjacency check.
            for (const spans of allSpanArrays) {
                for (let i = 0; i < spans.length - 1; i++) {
                    const currentSpan = spans[i]
                    const nextSpan = spans[i + 1]

                    if (
                        currentSpan.spanType === "span-link" &&
                        nextSpan.spanType === "span-link" &&
                        currentSpan.url === nextSpan.url
                    ) {
                        malformedGdocs.push(gdoc)
                        issueFound = true
                        break // Move to the next list of spans
                    }
                }
                if (issueFound) break // Move to the next gdoc
            }
        }

        const malformedSlugs = Array.from(malformedGdocs).map((g) => g.slug)
        console.log("Found malformed gdocs:", malformedSlugs)
    })
}

main()
    .catch((e) => {
        console.error(e)
    })
    .finally(() => {
        process.exit()
    })
