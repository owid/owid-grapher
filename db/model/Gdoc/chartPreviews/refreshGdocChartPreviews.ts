import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import pMap from "p-map"
import {
    GdocChartPreviewItem,
    GdocChartPreviewRefreshResult,
} from "@ourworldindata/types"
import { OwidGoogleAuth } from "../../../OwidGoogleAuth.js"
import * as db from "../../../db.js"
import {
    type ChartPreviewBlock,
    type ChartPreviewChange,
    findChartPreviewBlocks,
    makeChartPreviewRequests,
} from "./chartPreviewBlocks.js"
import {
    chartPreviewSpecKey,
    resolveChartPreviewSources,
} from "./chartPreviewSources.js"

export interface RefreshGdocChartPreviewsOptions {
    /** Also add images above chart components that have none */
    insertMissing?: boolean
    /** Report what would change without writing to the doc */
    dryRun?: boolean
}

const RENDER_TIMEOUT_MS = 60_000
const RENDER_CONCURRENCY = 4

function makeItem(
    block: ChartPreviewBlock,
    status: GdocChartPreviewItem["status"],
    message?: string
): GdocChartPreviewItem {
    return {
        tabTitle: block.tabTitle,
        componentType: block.spec.type,
        target: block.spec.target,
        status,
        ...(message ? { message } : {}),
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/**
 * Google fetches the image itself when we write the request, and a single URL
 * it can't fetch fails the whole batch. Rendering each image once beforehand
 * lets us skip the broken ones, and warms the thumbnail cache so Google's
 * fetch is fast.
 */
async function checkImageRenders(imageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl, {
            signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
        })
        const contentType = response.headers.get("content-type") ?? ""
        if (!response.ok) return `Rendering failed with ${response.status}`
        if (!contentType.startsWith("image/"))
            return `Rendering returned ${contentType} instead of an image`
        await response.arrayBuffer()
        return null
    } catch (error) {
        return `Rendering failed: ${getErrorMessage(error)}`
    }
}

/**
 * Writes the changes in one batch. If Google rejects the batch, falls back to
 * writing each change on its own so that one bad image doesn't block the rest.
 * All writes target the revision we read, so Google adjusts our positions for
 * any edits made since then, including our own earlier writes.
 */
async function writeChanges(
    docsClient: docs_v1.Docs,
    document: docs_v1.Schema$Document,
    replacements: ChartPreviewChange[],
    insertions: ChartPreviewChange[]
): Promise<Map<ChartPreviewChange, string>> {
    const failures = new Map<ChartPreviewChange, string>()
    const write = (requests: docs_v1.Schema$Request[]): Promise<unknown> =>
        docsClient.documents.batchUpdate({
            documentId: document.documentId!,
            requestBody: {
                requests,
                writeControl: { targetRevisionId: document.revisionId },
            },
        })

    try {
        await write(makeChartPreviewRequests(replacements, insertions))
        return failures
    } catch (error) {
        if (replacements.length + insertions.length === 1) {
            failures.set(
                [...replacements, ...insertions][0],
                getErrorMessage(error)
            )
            return failures
        }
    }

    for (const change of replacements) {
        await write(makeChartPreviewRequests([change], [])).catch((error) =>
            failures.set(change, getErrorMessage(error))
        )
    }
    for (const change of insertions) {
        await write(makeChartPreviewRequests([], [change])).catch((error) =>
            failures.set(change, getErrorMessage(error))
        )
    }
    return failures
}

/**
 * Makes the preview image above each chart component in a gdoc show the
 * current version of the chart. Replaces images that are outdated or were
 * pasted in by hand, and optionally inserts images where there are none.
 * Covers all tabs of the doc.
 */
export async function refreshGdocChartPreviews(
    knex: db.KnexReadonlyTransaction,
    gdocId: string,
    options: RefreshGdocChartPreviewsOptions = {}
): Promise<GdocChartPreviewRefreshResult> {
    const { insertMissing = false, dryRun = false } = options
    const docsClient = googleDocs({
        version: "v1",
        auth: OwidGoogleAuth.getGoogleReadWriteAuth(),
    })
    const { data: document } = await docsClient.documents.get({
        documentId: gdocId,
        includeTabsContent: true,
        // Write requests address positions in this view of the document
        suggestionsViewMode: "SUGGESTIONS_INLINE",
    })

    const blocks = findChartPreviewBlocks(document)
    const sources = await resolveChartPreviewSources(
        knex,
        blocks.map((block) => block.spec)
    )

    const items = new Map<ChartPreviewBlock, GdocChartPreviewItem>()
    const replacements: ChartPreviewChange[] = []
    const insertions: ChartPreviewChange[] = []
    for (const block of blocks) {
        const source = sources.get(chartPreviewSpecKey(block.spec))
        if (!source || source.status === "unresolved") {
            items.set(block, makeItem(block, "unresolved", source?.message))
        } else if (block.image?.sourceUri === source.imageUrl) {
            items.set(block, makeItem(block, "upToDate"))
        } else if (block.image) {
            replacements.push({ block, imageUrl: source.imageUrl })
            items.set(block, makeItem(block, "updated"))
        } else if (insertMissing) {
            insertions.push({ block, imageUrl: source.imageUrl })
            items.set(block, makeItem(block, "inserted"))
        } else {
            items.set(block, makeItem(block, "missing"))
        }
    }

    if (!dryRun && replacements.length + insertions.length > 0) {
        const imageUrls = [
            ...new Set([...replacements, ...insertions].map((c) => c.imageUrl)),
        ]
        const renderErrors = new Map(
            await pMap(
                imageUrls,
                async (url) => [url, await checkImageRenders(url)] as const,
                { concurrency: RENDER_CONCURRENCY }
            )
        )
        const renders = (change: ChartPreviewChange): boolean => {
            const error = renderErrors.get(change.imageUrl)
            if (error)
                items.set(change.block, makeItem(change.block, "failed", error))
            return !error
        }
        const renderedReplacements = replacements.filter(renders)
        const renderedInsertions = insertions.filter(renders)

        if (renderedReplacements.length + renderedInsertions.length > 0) {
            const failures = await writeChanges(
                docsClient,
                document,
                renderedReplacements,
                renderedInsertions
            )
            for (const [change, message] of failures) {
                items.set(
                    change.block,
                    makeItem(change.block, "failed", message)
                )
            }
        }
    }

    return {
        gdocId,
        dryRun,
        items: blocks.map((block) => items.get(block)!),
    }
}
