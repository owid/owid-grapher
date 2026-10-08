/*
 * The Drive side of the library: the Google Docs live in one fixed folder
 * and are recognised by their `appProperties` (`owidRefKind` = component |
 * template | guide | index, `owidRefId` = the item id), never by name — so
 * titles can change freely. A document is found, created or renamed to
 * match the plan; documents whose properties match no current item are
 * moved to the trash (reversible in Drive for 30 days). Files without
 * `owidRefKind` are not ours and are left alone.
 *
 * Content is written by uploading Markdown as the file's media: Drive
 * converts it into the Google Doc and replaces the full contents, keeping
 * the file id, URL and appProperties. The hash of the uploaded Markdown is
 * stored in `owidRefHash`, so an unchanged document is never re-uploaded.
 */

import type { drive_v3 } from "@googleapis/drive"
import type { DocRef, ReferenceDocKind } from "./model.js"
import { type Sleep, withRetry } from "./retry.js"

export const KIND_PROPERTY = "owidRefKind"
export const ID_PROPERTY = "owidRefId"
export const HASH_PROPERTY = "owidRefHash"

/**
 * The media type of the content upload. Drive imports Markdown into a Google
 * Doc; should that conversion ever fail, "text/plain" puts the literal
 * Markdown in the document instead (same code path).
 */
export const MARKDOWN_MIME_TYPE = "text/markdown"

const DOCS_MIME_TYPE = "application/vnd.google-apps.document"
const FILE_FIELDS = "id,name,appProperties,createdTime"

/** A file of the folder as `files.list` returns it */
export interface LibraryFile {
    id: string
    name: string
    appProperties?: Record<string, string>
    createdTime: string
}

export interface EnsuredDoc {
    fileId: string
    /** The document was created on this run */
    created: boolean
    /** The document existed under another name and was renamed */
    renamed: boolean
    /** `owidRefHash` of the content last uploaded, if any */
    storedHash?: string
}

export function docUrl(fileId: string): string {
    return `https://docs.google.com/document/d/${fileId}`
}

export function docRefKey(ref: DocRef): string {
    return `${ref.kind}:${ref.id}`
}

/** Every non-trashed file in the folder, across pages */
export async function listLibraryFiles(
    drive: drive_v3.Drive,
    folderId: string,
    sleep?: Sleep
): Promise<LibraryFile[]> {
    const files: LibraryFile[] = []
    let pageToken: string | undefined
    do {
        const { data } = await withRetry(
            () =>
                drive.files.list({
                    q: `'${folderId}' in parents and trashed = false`,
                    fields: `nextPageToken, files(${FILE_FIELDS})`,
                    pageSize: 100,
                    pageToken,
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true,
                }),
            { sleep }
        )
        for (const file of data.files ?? [])
            files.push({
                id: file.id!,
                name: file.name ?? "",
                appProperties: file.appProperties ?? undefined,
                createdTime: file.createdTime ?? "",
            })
        pageToken = data.nextPageToken ?? undefined
    } while (pageToken)
    return files
}

export class DriveLibrary {
    /** Our files by kind:id, the earliest created one when there are several */
    private readonly byRef = new Map<string, LibraryFile>()

    private constructor(
        private readonly drive: drive_v3.Drive,
        private readonly folderId: string,
        private readonly files: LibraryFile[],
        private readonly log: (message: string) => void,
        private readonly sleep?: Sleep
    ) {
        for (const file of sortedByCreation(files)) {
            const ref = refOf(file)
            if (!ref) continue
            const key = docRefKey(ref)
            const first = this.byRef.get(key)
            if (!first) this.byRef.set(key, file)
            else
                this.log(
                    `Warning: "${file.name}" (${file.id}) duplicates "${first.name}" (${first.id}) for ${key}; using the older one`
                )
        }
    }

    static async open(
        drive: drive_v3.Drive,
        folderId: string,
        log: (message: string) => void,
        sleep?: Sleep
    ): Promise<DriveLibrary> {
        const files = await listLibraryFiles(drive, folderId, sleep)
        return new DriveLibrary(drive, folderId, files, log, sleep)
    }

    /** The document for `ref`, created or renamed as needed, by its file id */
    async ensureDoc(ref: DocRef, title: string): Promise<EnsuredDoc> {
        const existing = this.byRef.get(docRefKey(ref))
        if (!existing) {
            const fileId = await this.create(ref, title)
            this.log(`Created "${title}" (${fileId})`)
            return { fileId, created: true, renamed: false }
        }
        if (existing.name !== title) {
            await this.update(existing.id, { name: title })
            this.log(`Renamed "${existing.name}" to "${title}"`)
            existing.name = title
            return {
                fileId: existing.id,
                created: false,
                renamed: true,
                storedHash: existing.appProperties?.[HASH_PROPERTY],
            }
        }
        return {
            fileId: existing.id,
            created: false,
            renamed: false,
            storedHash: existing.appProperties?.[HASH_PROPERTY],
        }
    }

    /**
     * Replaces the document's content with `markdown` (converted by Drive)
     * and records its `hash`, in one call.
     */
    async uploadMarkdown(
        fileId: string,
        markdown: string,
        hash: string
    ): Promise<void> {
        await withRetry(
            () =>
                this.drive.files.update({
                    fileId,
                    supportsAllDrives: true,
                    requestBody: { appProperties: { [HASH_PROPERTY]: hash } },
                    media: { mimeType: MARKDOWN_MIME_TYPE, body: markdown },
                }),
            { sleep: this.sleep, log: this.log }
        )
    }

    /**
     * Trashes every file of ours whose kind:id is not among `current`; files
     * without `owidRefKind` are left alone. Returns the trashed names.
     */
    async trashOrphans(current: DocRef[]): Promise<string[]> {
        const keep = new Set(current.map(docRefKey))
        const trashed: string[] = []
        for (const file of this.files) {
            const ref = refOf(file)
            if (!ref || keep.has(docRefKey(ref))) continue
            await this.update(file.id, { trashed: true })
            this.log(
                `Trashed "${file.name}" (${file.id}): no current ${ref.kind} "${ref.id}"`
            )
            trashed.push(file.name)
        }
        return trashed
    }

    private async create(ref: DocRef, title: string): Promise<string> {
        const { data } = await withRetry(
            () =>
                this.drive.files.create({
                    supportsAllDrives: true,
                    fields: "id",
                    requestBody: {
                        parents: [this.folderId],
                        mimeType: DOCS_MIME_TYPE,
                        name: title,
                        appProperties: {
                            [KIND_PROPERTY]: ref.kind,
                            [ID_PROPERTY]: ref.id,
                        },
                    },
                    media: { mimeType: DOCS_MIME_TYPE, body: "" },
                }),
            { sleep: this.sleep, log: this.log }
        )
        if (!data.id) throw new Error(`Drive returned no id for "${title}"`)
        return data.id
    }

    private async update(
        fileId: string,
        requestBody: drive_v3.Schema$File
    ): Promise<void> {
        await withRetry(
            () =>
                this.drive.files.update({
                    fileId,
                    supportsAllDrives: true,
                    requestBody,
                }),
            { sleep: this.sleep, log: this.log }
        )
    }
}

/** The library ref a file carries, or undefined for a file that isn't ours */
export function refOf(file: LibraryFile): DocRef | undefined {
    const kind = file.appProperties?.[KIND_PROPERTY]
    const id = file.appProperties?.[ID_PROPERTY]
    if (!isDocKind(kind) || !id) return undefined
    return { kind, id }
}

function isDocKind(value: unknown): value is ReferenceDocKind {
    return (
        value === "component" ||
        value === "template" ||
        value === "guide" ||
        value === "index"
    )
}

function sortedByCreation(files: LibraryFile[]): LibraryFile[] {
    return [...files].sort((a, b) => a.createdTime.localeCompare(b.createdTime))
}
