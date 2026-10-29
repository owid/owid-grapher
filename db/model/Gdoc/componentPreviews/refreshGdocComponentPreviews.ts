import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import pMap from "p-map"
import { GdocComponentPreviewRefreshResult } from "@ourworldindata/types"
import {
    CLOUDFLARE_IMAGES_URL,
    GDOCS_CHART_PREVIEW_EXPLORER_URL,
    GDOCS_CHART_PREVIEW_GRAPHER_URL,
} from "../../../../settings/serverSettings.js"
import { OwidGoogleAuth } from "../../../OwidGoogleAuth.js"
import * as db from "../../../db.js"
import {
    type ComponentPreviewChange,
    findComponentPreviewBlocks,
    makeComponentPreviewRequests,
} from "./componentPreviewBlocks.js"
import { resolveComponentPreviewSources } from "./componentPreviewSources.js"
import {
    type PlannedChanges,
    makeItem,
    planComponentPreviewChanges,
} from "./componentPreviewPlan.js"

export interface RefreshGdocComponentPreviewsOptions {
    /** Report what would change without writing to the doc */
    dryRun?: boolean
}

const RENDER_TIMEOUT_MS = 60_000
const RENDER_CONCURRENCY = 4

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

const PREVIEW_URL_PREFIXES = [
    GDOCS_CHART_PREVIEW_GRAPHER_URL,
    GDOCS_CHART_PREVIEW_EXPLORER_URL,
    CLOUDFLARE_IMAGES_URL,
].filter(Boolean)

function countChanges(changes: PlannedChanges): number {
    return (
        changes.replacements.length +
        changes.insertions.length +
        changes.reinsertions.length
    )
}

function makeRequests(changes: PlannedChanges): docs_v1.Schema$Request[] {
    return makeComponentPreviewRequests(
        changes.replacements,
        changes.insertions,
        changes.reinsertions
    )
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
    changes: PlannedChanges
): Promise<Map<ComponentPreviewChange, string>> {
    const failures = new Map<ComponentPreviewChange, string>()
    const write = (requests: docs_v1.Schema$Request[]): Promise<unknown> =>
        docsClient.documents.batchUpdate({
            documentId: document.documentId!,
            requestBody: {
                requests,
                writeControl: { targetRevisionId: document.revisionId },
            },
        })

    try {
        await write(makeRequests(changes))
        return failures
    } catch (error) {
        if (countChanges(changes) === 1) {
            const [change] = [
                ...changes.replacements,
                ...changes.insertions,
                ...changes.reinsertions,
            ]
            failures.set(change, getErrorMessage(error))
            return failures
        }
    }

    const singleChanges: PlannedChanges[] = [
        ...changes.replacements.map((change) => ({
            replacements: [change],
            insertions: [],
            reinsertions: [],
        })),
        ...changes.insertions.map((change) => ({
            replacements: [],
            insertions: [change],
            reinsertions: [],
        })),
        ...changes.reinsertions.map((change) => ({
            replacements: [],
            insertions: [],
            reinsertions: [change],
        })),
    ]
    for (const single of singleChanges) {
        await write(makeRequests(single)).catch((error) => {
            const [change] = [
                ...single.replacements,
                ...single.insertions,
                ...single.reinsertions,
            ]
            failures.set(change, getErrorMessage(error))
        })
    }
    return failures
}

/**
 * Makes the preview image above each component in a gdoc show the current
 * version of the chart or uploaded image it refers to. Replaces images that
 * are outdated, were pasted in by hand or are cropped by a frame of the wrong
 * shape, and inserts images where there are none. Images below a component
 * are reported but left alone. Covers all tabs of the doc.
 */
export async function refreshGdocComponentPreviews(
    gdocId: string,
    options: RefreshGdocComponentPreviewsOptions = {}
): Promise<GdocComponentPreviewRefreshResult> {
    const { dryRun = false } = options
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

    const blocks = findComponentPreviewBlocks(document)
    // A transaction of its own, so that none is held open across the slow
    // Google API calls and image renders
    const sources = await db.knexReadonlyTransaction((knex) =>
        resolveComponentPreviewSources(
            knex,
            blocks.map((block) => block.spec)
        )
    )

    const { items, planned } = planComponentPreviewChanges(
        blocks,
        sources,
        PREVIEW_URL_PREFIXES
    )

    if (!dryRun && countChanges(planned) > 0) {
        const allChanges = [
            ...planned.replacements,
            ...planned.insertions,
            ...planned.reinsertions,
        ]
        const imageUrls = [...new Set(allChanges.map((c) => c.imageUrl))]
        const renderErrors = new Map(
            await pMap(
                imageUrls,
                async (url) => [url, await checkImageRenders(url)] as const,
                { concurrency: RENDER_CONCURRENCY }
            )
        )
        const renders = (change: ComponentPreviewChange): boolean => {
            const error = renderErrors.get(change.imageUrl)
            if (error)
                items.set(change.block, makeItem(change.block, "failed", error))
            return !error
        }
        const rendered: PlannedChanges = {
            replacements: planned.replacements.filter(renders),
            insertions: planned.insertions.filter(renders),
            reinsertions: planned.reinsertions.filter(renders),
        }

        if (countChanges(rendered) > 0) {
            const failures = await writeChanges(docsClient, document, rendered)
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
