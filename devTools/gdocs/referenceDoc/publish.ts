/*
 * The Google side of `yarn buildGdocsReferenceDoc`: writes the library —
 * one index plus one document per component, template and guide — into a
 * fixed Drive folder shared with the service account as an editor.
 *
 * Documents are found or created by their Drive `appProperties`
 * (`driveLibrary.ts`) before any content is built, so that every document
 * can link to the others. Each document is then written into its first tab
 * only: fetched, compared as plain text with what would be written, and
 * skipped when identical; otherwise cleared and refilled (tables in two
 * passes, see `renderDocsRequests.ts`). Documents matching no current item
 * are trashed. Rate limits (429) and transient errors (503) are retried with
 * backoff; any other failing call stops the run naming the document and the
 * chunk, and the next run repairs whatever was left half written.
 */

import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import { drive as googleDrive, type drive_v3 } from "@googleapis/drive"
import { OwidGoogleAuth } from "../../../db/OwidGoogleAuth.js"
import type { DocRef, ReferenceDoc, UrlFor } from "./model.js"
import { INDEX_REF } from "./model.js"
import {
    type ReferenceRegistries,
    buildReferenceLibrary,
    planLibraryDocs,
} from "./buildModel.js"
import {
    blocksToRequests,
    bodyPlainText,
    chunkRequests,
    fillTableRequests,
    locateTables,
    plainTextOf,
    type PlannedTable,
} from "./renderDocsRequests.js"
import { DriveLibrary, docRefKey, docUrl } from "./driveLibrary.js"
import { type Sleep, withRetry } from "./retry.js"

type Request = docs_v1.Schema$Request

export interface PublishOptions {
    /** The Drive folder holding the library (GDOCS_REFERENCE_FOLDER_ID) */
    folderId: string
    generatedAt: Date
    commitSha: string
    log?: (message: string) => void
    /** Clients to use instead of the service-account ones (tests) */
    client?: docs_v1.Docs
    driveClient?: drive_v3.Drive
    /** Backoff wait, replaceable in tests */
    sleep?: Sleep
}

export interface PublishResult {
    /** Drive names of the documents rewritten on this run */
    written: string[]
    /** Drive names of the documents whose text already matched */
    skipped: string[]
    /** Drive names of the documents moved to the trash */
    trashed: string[]
    /** The index document's URL — the one to share */
    indexUrl: string
}

export async function publishReferenceLibrary(
    registries: ReferenceRegistries,
    options: PublishOptions
): Promise<PublishResult> {
    const log = options.log ?? ((): void => undefined)
    const { client, driveClient } = resolveClients(options)
    const drive = await DriveLibrary.open(
        driveClient,
        options.folderId,
        log,
        options.sleep
    )

    // Every document first, so the content can link between them
    const planned = planLibraryDocs(registries)
    const fileIds = new Map<string, string>()
    for (const doc of planned) {
        const { fileId } = await drive.ensureDoc(doc, doc.docTitle)
        fileIds.set(docRefKey(doc), fileId)
    }
    const trashed = await drive.trashOrphans(planned)

    const urlFor: UrlFor = (ref: DocRef) => {
        const fileId = fileIds.get(docRefKey(ref))
        return fileId ? docUrl(fileId) : undefined
    }
    const library = buildReferenceLibrary(registries, {
        generatedAt: options.generatedAt,
        commitSha: options.commitSha,
        urlFor,
    })

    const publisher = new DocPublisher(client, log, options.sleep)
    const written: string[] = []
    const skipped: string[] = []
    const docs: [DocRef, ReferenceDoc][] = [
        [INDEX_REF, library.index],
        ...library.items.map((item): [DocRef, ReferenceDoc] => [item, item]),
    ]
    for (const [ref, doc] of docs) {
        const fileId = fileIds.get(docRefKey(ref))!
        const didWrite = await publisher.writeIfChanged(fileId, doc)
        if (didWrite) written.push(doc.docTitle)
        else skipped.push(doc.docTitle)
    }
    log(
        `Done: ${written.length} written, ${skipped.length} skipped (unchanged), ${trashed.length} trashed`
    )
    return {
        written,
        skipped,
        trashed,
        indexUrl: urlFor(INDEX_REF)!,
    }
}

function resolveClients(options: PublishOptions): {
    client: docs_v1.Docs
    driveClient: drive_v3.Drive
} {
    if (options.client && options.driveClient)
        return { client: options.client, driveClient: options.driveClient }
    if (!OwidGoogleAuth.areGdocAuthKeysSet())
        throw new Error(
            "GDOCS_CLIENT_EMAIL and GDOCS_PRIVATE_KEY must be set to write to Google Docs"
        )
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    return {
        client: options.client ?? googleDocs({ version: "v1", auth }),
        driveClient:
            options.driveClient ?? googleDrive({ version: "v3", auth }),
    }
}

function firstTab(document: docs_v1.Schema$Document): docs_v1.Schema$Tab {
    const tab = document.tabs?.[0]
    if (!tab?.tabProperties?.tabId)
        throw new Error(
            `Document ${document.documentId} has no tab to write into`
        )
    return tab
}

function tabContent(
    tab: docs_v1.Schema$Tab
): docs_v1.Schema$StructuralElement[] {
    return tab.documentTab?.body?.content ?? []
}

function tabEndIndex(tab: docs_v1.Schema$Tab): number {
    return tabContent(tab).at(-1)?.endIndex ?? 2
}

class DocPublisher {
    constructor(
        private readonly client: docs_v1.Docs,
        private readonly log: (message: string) => void,
        private readonly sleep?: Sleep
    ) {}

    /** Rewrites the document's first tab unless it already holds the text; says whether it wrote */
    async writeIfChanged(fileId: string, doc: ReferenceDoc): Promise<boolean> {
        const tab = firstTab(await this.fetch(fileId))
        if (bodyPlainText(tabContent(tab)) === plainTextOf(doc.blocks)) {
            this.log(`${doc.docTitle}: unchanged, skipped`)
            return false
        }
        const tabId = tab.tabProperties!.tabId!
        await this.clearTab(fileId, tab)
        await this.writeBlocks(fileId, tabId, doc)
        return true
    }

    private async fetch(fileId: string): Promise<docs_v1.Schema$Document> {
        const { data } = await withRetry(
            () =>
                this.client.documents.get({
                    documentId: fileId,
                    includeTabsContent: true,
                    suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
                }),
            { sleep: this.sleep, log: this.log }
        )
        return data
    }

    /** Empties the tab's body (index 1 … end-1; the final newline stays) */
    private async clearTab(
        fileId: string,
        tab: docs_v1.Schema$Tab
    ): Promise<void> {
        const endIndex = tabEndIndex(tab)
        if (endIndex - 1 <= 1) return
        await this.batchUpdate(
            fileId,
            [
                {
                    deleteContentRange: {
                        range: {
                            startIndex: 1,
                            endIndex: endIndex - 1,
                            tabId: tab.tabProperties!.tabId,
                        },
                    },
                },
            ],
            "clear",
            0,
            1
        )
    }

    private async writeBlocks(
        fileId: string,
        tabId: string,
        doc: ReferenceDoc
    ): Promise<void> {
        const pass1 = blocksToRequests(doc.blocks, tabId, 1)
        const chunks = chunkRequests(pass1.requests)
        this.log(
            `${doc.docTitle}: writing ${doc.blocks.length} blocks in ${chunks.length} chunk(s)`
        )
        for (const [index, chunk] of chunks.entries())
            await this.batchUpdate(
                fileId,
                chunk,
                `${doc.docTitle} pass 1`,
                index,
                chunks.length
            )
        if (pass1.tables.length > 0)
            await this.fillTables(fileId, tabId, doc.docTitle, pass1.tables)
    }

    private async fillTables(
        fileId: string,
        tabId: string,
        title: string,
        planned: PlannedTable[]
    ): Promise<void> {
        const tab = firstTab(await this.fetch(fileId))
        if (tab.tabProperties?.tabId !== tabId)
            throw new Error(`${title}: the first tab changed while writing`)
        const located = locateTables(tabContent(tab))
        const chunks = chunkRequests(fillTableRequests(planned, located, tabId))
        this.log(
            `${title}: filling ${planned.length} table(s) in ${chunks.length} chunk(s)`
        )
        for (const [index, chunk] of chunks.entries())
            await this.batchUpdate(
                fileId,
                chunk,
                `${title} pass 2`,
                index,
                chunks.length
            )
    }

    private async batchUpdate(
        fileId: string,
        requests: Request[],
        label: string,
        chunkIndex: number,
        chunkCount: number
    ): Promise<void> {
        try {
            await withRetry(
                () =>
                    this.client.documents.batchUpdate({
                        documentId: fileId,
                        requestBody: { requests },
                    }),
                { sleep: this.sleep, log: this.log }
            )
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            throw new Error(
                `batchUpdate failed (${label}, chunk ${chunkIndex + 1}/${chunkCount}, ${requests.length} requests): ${message}`,
                { cause: error }
            )
        }
    }
}
