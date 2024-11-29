import parseArgs from "minimist"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"
import {
    DbRawPostGdoc,
    OwidEnrichedGdocBlock,
    parsePostGdocContent,
    Span,
} from "@ourworldindata/types"
import { omit, traverseEnrichedSpan } from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { flatten } from "lodash"

function handleComponent<T extends OwidEnrichedGdocBlock, S extends keyof T>(
    component: T,
    childProperties: (keyof T)[],
    childIterator?: (parent: T) => OwidEnrichedGdocBlock[][]
): Record<string, unknown>[] {
    const item = omit({ ...component }, childProperties)

    const iterator: (parent: T) => OwidEnrichedGdocBlock[][] =
        childIterator ??
        ((parent) =>
            childProperties.map(
                (prop) => parent[prop] as OwidEnrichedGdocBlock[]
            ))
    const children = flatten(iterator(component))
    return [item, ...children]
}

function enumerateGdocComponentsWithoutChildren(
    node: OwidEnrichedGdocBlock
): Record<string, unknown>[] {
    return match(node)
        .with(
            { type: P.union("sticky-right", "sticky-left", "side-by-side") },
            (container) => handleComponent(container, ["left", "right"])
        )
        .with({ type: "gray-section" }, (graySection) =>
            handleComponent(graySection, ["items"])
        )
        .with({ type: "key-insights" }, (keyInsights) =>
            handleComponent(keyInsights, ["insights"], (parent) =>
                parent.insights.map((insight) => insight.content)
            )
        )
        .with({ type: "callout" }, (callout) =>
            handleComponent(callout, ["text"])
        )
        .with({ type: "list" }, (list) => handleComponent(list, ["items"]))
        .with({ type: "numbered-list" }, (numberedList) =>
            handleComponent(numberedList, ["items"])
        )
        .with({ type: "expandable-paragraph" }, (expandableParagraph) =>
            handleComponent(expandableParagraph, ["items"])
        )
        .with({ type: "align" }, (align) => handleComponent(align, ["content"]))
        .with({ type: "table" }, (table) =>
            handleComponent(table, ["rows"], (parent) =>
                parent.rows.map((r) => r.cells.flatMap((c) => c.content))
            )
        )
        .with({ type: "blockquote" }, (blockquote) =>
            handleComponent(blockquote, ["text"])
        )
        .with(
            {
                type: "key-indicator",
            },
            (keyIndicator) => handleComponent(keyIndicator, ["text"])
        )
        .with({ type: "key-indicator-collection" }, (keyIndicatorCollection) =>
            handleComponent(keyIndicatorCollection, ["blocks"])
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
                    "socials",
                    "aside",
                    "text",
                    "heading",
                    "additional-charts",
                    "simple-text"
                ),
            },
            (c) => handleComponent(c, [])
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
