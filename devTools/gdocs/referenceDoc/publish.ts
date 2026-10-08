/*
 * The Google side of `yarn buildGdocsReferenceDoc`: writes the library —
 * one index plus one document per component, template and guide — into a
 * fixed Drive folder shared with the service account as an editor.
 *
 * Documents are found or created by their Drive `appProperties`
 * (`driveLibrary.ts`) before any content is built, so that every document
 * can link to the others. Each document's Markdown is then hashed: when the
 * hash matches the `owidRefHash` stored on the file, the document is
 * skipped; otherwise the Markdown is uploaded as the file's media (Drive
 * converts it and replaces the contents) together with the new hash.
 * Documents matching no current item are trashed. Rate limits (429) and
 * transient errors (503) are retried with backoff; any other failing call
 * stops the run naming the document, and the next run repairs the rest.
 */

import { createHash } from "crypto"
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
    DriveLibrary,
    MARKDOWN_MIME_TYPE,
    docRefKey,
    docUrl,
} from "./driveLibrary.js"
import type { Sleep } from "./retry.js"

export interface PublishOptions {
    /** The Drive folder holding the library (GDOCS_REFERENCE_FOLDER_ID) */
    folderId: string
    generatedAt: Date
    commitSha: string
    log?: (message: string) => void
    /** Client to use instead of the service-account one (tests) */
    driveClient?: drive_v3.Drive
    /** Backoff wait, replaceable in tests */
    sleep?: Sleep
}

export interface PublishResult {
    /** Drive names of the documents uploaded on this run */
    written: string[]
    /** Drive names of the documents whose content was unchanged */
    skipped: string[]
    /** Drive names of the documents moved to the trash */
    trashed: string[]
    /** The index document's URL — the one to share */
    indexUrl: string
}

/**
 * The content hash stored in `owidRefHash`. It covers the upload's media type
 * too, so flipping MARKDOWN_MIME_TYPE (the text/plain fallback) re-uploads
 * every document.
 */
export function markdownHash(
    markdown: string,
    mimeType: string = MARKDOWN_MIME_TYPE
): string {
    return createHash("sha256").update(`${mimeType}\n${markdown}`).digest("hex")
}

export async function publishReferenceLibrary(
    registries: ReferenceRegistries,
    options: PublishOptions
): Promise<PublishResult> {
    const log = options.log ?? ((): void => undefined)
    const drive = await DriveLibrary.open(
        resolveDriveClient(options),
        options.folderId,
        log,
        options.sleep
    )

    // Every document first, so the content can link between them
    const planned = planLibraryDocs(registries)
    const fileIds = new Map<string, string>()
    const storedHashes = new Map<string, string | undefined>()
    for (const doc of planned) {
        const { fileId, storedHash } = await drive.ensureDoc(doc, doc.docTitle)
        fileIds.set(docRefKey(doc), fileId)
        storedHashes.set(docRefKey(doc), storedHash)
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

    const written: string[] = []
    const skipped: string[] = []
    const docs: [DocRef, ReferenceDoc][] = [
        [INDEX_REF, library.index],
        ...library.items.map((item): [DocRef, ReferenceDoc] => [item, item]),
    ]
    for (const [ref, doc] of docs) {
        const key = docRefKey(ref)
        const hash = markdownHash(doc.markdown)
        if (storedHashes.get(key) === hash) {
            log(`${doc.docTitle}: unchanged, skipped`)
            skipped.push(doc.docTitle)
            continue
        }
        try {
            await drive.uploadMarkdown(fileIds.get(key)!, doc.markdown, hash)
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            throw new Error(`Upload failed for "${doc.docTitle}": ${message}`, {
                cause: error,
            })
        }
        log(`${doc.docTitle}: uploaded`)
        written.push(doc.docTitle)
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

function resolveDriveClient(options: PublishOptions): drive_v3.Drive {
    if (options.driveClient) return options.driveClient
    if (!OwidGoogleAuth.areGdocAuthKeysSet())
        throw new Error(
            "GDOCS_CLIENT_EMAIL and GDOCS_PRIVATE_KEY must be set to write to Google Docs"
        )
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    return googleDrive({ version: "v3", auth })
}
