import parseArgs from "minimist"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"
import {
    DbRawPostGdoc,
    OwidEnrichedGdocBlock,
    parsePostGdocContent,
    Span,
} from "@ourworldindata/types"
import { traverseEnrichedSpan } from "@ourworldindata/utils"
import { match, P } from "ts-pattern"

// If your node is a OwidEnrichedGdocBlock, the callback will apply to it
// If your node has children that are Spans, the spanCallback will apply to them
// If your node has children that aren't OwidEnrichedGdocBlocks or Spans, e.g. EnrichedBlockScroller & EnrichedScrollerItem
// you'll have to handle those children yourself in your callback
function* traverseEnrichedBlock(
    node: OwidEnrichedGdocBlock
): Generator<Record<string, unknown>> {
    match(node)
        .with(
            { type: P.union("sticky-right", "sticky-left", "side-by-side") },
            (container) => {
                callback(container)
                container.left.forEach((leftNode) =>
                    traverseEnrichedBlock(leftNode, callback, spanCallback)
                )
                container.right.forEach((rightNode) =>
                    traverseEnrichedBlock(rightNode, callback, spanCallback)
                )
            }
        )
        .with({ type: "gray-section" }, (graySection) => {
            callback(graySection)
            graySection.items.forEach((node) =>
                traverseEnrichedBlock(node, callback, spanCallback)
            )
        })
        .with({ type: "key-insights" }, (keyInsights) => {
            callback(keyInsights)
            keyInsights.insights.forEach((insight) =>
                insight.content.forEach((node) =>
                    traverseEnrichedBlock(node, callback, spanCallback)
                )
            )
        })
        .with({ type: "callout" }, (callout) => {
            callback(callout)
            if (spanCallback) {
                callout.text.forEach((textBlock) =>
                    traverseEnrichedBlock(textBlock, callback, spanCallback)
                )
            }
        })
        .with({ type: "aside" }, (aside) => {
            callback(aside)
            if (spanCallback) {
                aside.caption.forEach((span) =>
                    traverseEnrichedSpan(span, spanCallback)
                )
            }
        })
        .with({ type: "list" }, (list) => {
            callback(list)
            if (spanCallback) {
                list.items.forEach((textBlock) =>
                    traverseEnrichedBlock(textBlock, callback, spanCallback)
                )
            }
        })
        .with({ type: "numbered-list" }, (numberedList) => {
            callback(numberedList)
            if (spanCallback) {
                numberedList.items.forEach((textBlock) =>
                    traverseEnrichedBlock(textBlock, callback, spanCallback)
                )
            }
        })
        .with({ type: "text" }, (textNode) => {
            callback(textNode)
            if (spanCallback) {
                textNode.value.forEach((span) => {
                    traverseEnrichedSpan(span, spanCallback)
                })
            }
        })
        .with({ type: "simple-text" }, (simpleTextNode) => {
            if (spanCallback) {
                spanCallback(simpleTextNode.value)
            }
        })
        .with({ type: "additional-charts" }, (additionalCharts) => {
            callback(additionalCharts)
            if (spanCallback) {
                additionalCharts.items.forEach((spans) => {
                    spans.forEach((span) =>
                        traverseEnrichedSpan(span, spanCallback)
                    )
                })
            }
        })
        .with({ type: "heading" }, (heading) => {
            callback(heading)
            if (spanCallback) {
                heading.text.forEach((span) => {
                    traverseEnrichedSpan(span, spanCallback)
                })
            }
        })
        .with({ type: "expandable-paragraph" }, (expandableParagraph) => {
            callback(expandableParagraph)
            expandableParagraph.items.forEach((textBlock) => {
                traverseEnrichedBlock(textBlock, callback, spanCallback)
            })
        })
        .with({ type: "align" }, (align) => {
            callback(align)
            align.content.forEach((node) => {
                traverseEnrichedBlock(node, callback, spanCallback)
            })
        })
        .with({ type: "table" }, (table) => {
            callback(table)
            table.rows.forEach((row) => {
                row.cells.forEach((cell) => {
                    cell.content.forEach((node) => {
                        traverseEnrichedBlock(node, callback, spanCallback)
                    })
                })
            })
        })
        .with({ type: "blockquote" }, (blockquote) => {
            callback(blockquote)
            blockquote.text.forEach((node) => {
                traverseEnrichedBlock(node, callback, spanCallback)
            })
        })
        .with(
            {
                type: "key-indicator",
            },
            (keyIndicator) => {
                callback(keyIndicator)
                keyIndicator.text.forEach((node) => {
                    traverseEnrichedBlock(node, callback, spanCallback)
                })
            }
        )
        .with(
            { type: "key-indicator-collection" },
            (keyIndicatorCollection) => {
                callback(keyIndicatorCollection)
                keyIndicatorCollection.blocks.forEach((node) =>
                    traverseEnrichedBlock(node, callback, spanCallback)
                )
            }
        )
        .with(
            {
                type: P.union(
                    "chart-story",
                    "chart",
                    "horizontal-rule",
                    "html",
                    "image",
                    "video",
                    "missing-data",
                    "prominent-link",
                    "pull-quote",
                    "recirc",
                    "research-and-writing",
                    "scroller",
                    "sdg-grid",
                    "sdg-toc",
                    "topic-page-intro",
                    "all-charts",
                    "entry-summary",
                    "explorer-tiles",
                    "pill-row",
                    "homepage-search",
                    "homepage-intro",
                    "latest-data-insights",
                    "socials"
                ),
            },
            callback
        )
        .exhaustive()
}

async function main(parsedArgs: parseArgs.ParsedArgs) {
    await knexReadonlyTransaction(async (trx) => {
        await knexRaw(trx, `DELETE FROM posts_gdocs_components`)
        const postsGdocsRaw = await knexRaw<
            Pick<DbRawPostGdoc, "id" | "content">
        >(trx, `SELECT id, content FROM posts_gdocs`)
        for (const gdocRaw of postsGdocsRaw) {
            const gdocEnriched = {
                ...gdocRaw,
                content: parsePostGdocContent(gdocRaw.content),
            }
            const startPath = "$.body"
            const body = gdocEnriched.content.body
        }
    })
    process.exit(0)
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(
        `reconstructPostsGdocsComponents - Reconstruct posts_gdocs_components table from posts_gdocs table`
    )
} else {
    main(parsedArgs, parsedArgs["dry-run"])
}
