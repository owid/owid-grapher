/*
 * The Google side of `yarn buildGdocsReferenceDoc`: writes the library —
 * one index plus one Markdown file per component, template and guide — into
 * a fixed Drive folder shared with the service account as an editor.
 *
 * Every file's id is known before any content is built, so that every file
 * can link to the others: existing files are found by their Drive
 * `appProperties` (`driveLibrary.ts`), and ids for the missing ones are
 * reserved in a single `files.generateIds` call. Each file's Markdown is then
 * hashed: a missing file is created with its content; an existing one whose
 * stored `owidRefHash` (or name) differs is updated in place; an unchanged
 * one is skipped. No file is ever created empty. Files matching no current
 * item are trashed. Rate limits (429) and transient errors (503) are retried
 * with backoff; any other failing call stops the run naming the file, and
 * the next run repairs the rest.
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
    type ExistingFile,
    docRefKey,
    fileUrl,
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
    /** Drive names of the files uploaded on this run (created or updated) */
    written: string[]
    /** Drive names of the files created on this run (a subset of `written`) */
    created: string[]
    /** Drive names of the files whose content and name were unchanged */
    skipped: string[]
    /** Drive names of the files moved to the trash */
    trashed: string[]
    /** The index file's URL — the one to share */
    indexUrl: string
}

/** The content hash stored in `owidRefHash` */
export function markdownHash(markdown: string): string {
    return createHash("sha256").update(markdown).digest("hex")
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

    // Every file id first, so the content can link between them
    const planned = planLibraryDocs(registries)
    const existingByKey = new Map<string, ExistingFile>()
    for (const doc of planned) {
        const existing = drive.existing(doc)
        if (existing) existingByKey.set(docRefKey(doc), existing)
    }
    const missing = planned.filter((doc) => !existingByKey.has(docRefKey(doc)))
    const reservedIds = await drive.reserveIds(missing.length)
    const fileIds = new Map<string, string>()
    for (const [key, existing] of existingByKey)
        fileIds.set(key, existing.fileId)
    missing.forEach((doc, i) => fileIds.set(docRefKey(doc), reservedIds[i]))

    const trashed = await drive.trashOrphans(planned)

    const urlFor: UrlFor = (ref: DocRef) => {
        const fileId = fileIds.get(docRefKey(ref))
        return fileId ? fileUrl(fileId) : undefined
    }
    const library = buildReferenceLibrary(registries, {
        generatedAt: options.generatedAt,
        commitSha: options.commitSha,
        urlFor,
    })

    const written: string[] = []
    const created: string[] = []
    const skipped: string[] = []
    const docs: [DocRef, ReferenceDoc][] = [
        [INDEX_REF, library.index],
        ...library.items.map((item): [DocRef, ReferenceDoc] => [item, item]),
    ]
    for (const [ref, doc] of docs) {
        const key = docRefKey(ref)
        const name = doc.docTitle
        const fileId = fileIds.get(key)!
        const existing = existingByKey.get(key)
        const hash = markdownHash(doc.markdown)
        const renamed = existing !== undefined && existing.name !== name
        if (existing && existing.storedHash === hash && !renamed) {
            log(`${name}: unchanged, skipped`)
            skipped.push(name)
            continue
        }
        try {
            if (!existing)
                await drive.createFile(ref, name, fileId, doc.markdown, hash)
            else
                await drive.updateFile(
                    fileId,
                    doc.markdown,
                    hash,
                    renamed ? name : undefined
                )
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            throw new Error(`Upload failed for "${name}": ${message}`, {
                cause: error,
            })
        }
        if (!existing) {
            log(`${name}: created (${fileId})`)
            created.push(name)
        } else if (renamed)
            log(`${name}: renamed from "${existing.name}", uploaded`)
        else log(`${name}: uploaded`)
        written.push(name)
    }
    log(
        `Done: ${written.length} written (${created.length} created), ${skipped.length} skipped (unchanged), ${trashed.length} trashed`
    )
    return {
        written,
        created,
        skipped,
        trashed,
        indexUrl: urlFor(INDEX_REF)!,
    }
}

function resolveDriveClient(options: PublishOptions): drive_v3.Drive {
    if (options.driveClient) return options.driveClient
    if (!OwidGoogleAuth.areGdocAuthKeysSet())
        throw new Error(
            "GDOCS_CLIENT_EMAIL and GDOCS_PRIVATE_KEY must be set to write to Google Drive"
        )
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    return googleDrive({ version: "v3", auth })
}
