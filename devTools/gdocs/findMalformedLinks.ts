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

            // Default case for blocks that don't directly contain spans.
            // Container blocks like 'sticky-right', 'gray-section', 'callout', etc.,
            // are handled by the `traverseEnrichedBlock` function, which will
            // recursively call this callback on their children.
            default:
                break
        }
    }

    body.forEach((block) => traverseEnrichedBlock(block, blockCallback))

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
