/*
 * The Drive side of the library: plain Markdown files (`text/markdown`, no
 * Google Docs, no conversion) in one fixed folder, recognised by their
 * `appProperties` (`owidRefKind` = component | template | guide | index,
 * `owidRefId` = the item id), never by name. Only Markdown files count: a
 * file of ours with another media type (a leftover Google Doc) is an orphan.
 * Files whose properties match no current item are moved to the trash
 * (reversible in Drive for 30 days). Files without `owidRefKind` are not
 * ours and are left alone.
 *
 * A missing file gets its id reserved up front (`files.generateIds`), so
 * every file can link to every other before any of them exists, and is then
 * created once, with its full content. An existing file is updated in place:
 * new media, hash and (when it changed) name in one call, keeping its id and
 * URL. The hash of the uploaded Markdown is stored in `owidRefHash`, so an
 * unchanged file is never re-uploaded.
 */

import type { drive_v3 } from "@googleapis/drive"
import type { DocRef, ReferenceDocKind } from "./model.js"
import { type Sleep, withRetry } from "./retry.js"

export const KIND_PROPERTY = "owidRefKind"
export const ID_PROPERTY = "owidRefId"
export const HASH_PROPERTY = "owidRefHash"

/** The media type of every library file, stored as is (never converted) */
export const MARKDOWN_MIME_TYPE = "text/markdown"

const FILE_FIELDS = "id,name,mimeType,appProperties,createdTime"

/** The most ids one `files.generateIds` call returns */
const MAX_GENERATED_IDS = 1000

/** A file of the folder as `files.list` returns it */
export interface LibraryFile {
    id: string
    name: string
    mimeType: string
    appProperties?: Record<string, string>
    createdTime: string
}

/** The Markdown file already holding a ref */
export interface ExistingFile {
    fileId: string
    name: string
    /** `owidRefHash` of the content last uploaded, if any */
    storedHash?: string
}

export function fileUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`
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
                mimeType: file.mimeType ?? "",
                appProperties: file.appProperties ?? undefined,
                createdTime: file.createdTime ?? "",
            })
        pageToken = data.nextPageToken ?? undefined
    } while (pageToken)
    return files
}

export class DriveLibrary {
    /**
     * Our Markdown files by kind:id, the earliest created one when there are
     * several
     */
    private readonly byRef = new Map<string, LibraryFile>()

    private constructor(
        private readonly drive: drive_v3.Drive,
        private readonly folderId: string,
        private readonly files: LibraryFile[],
        private readonly log: (message: string) => void,
        private readonly sleep?: Sleep
    ) {
        for (const file of sortedByCreation(files)) {
            const ref = markdownRefOf(file)
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

    /** The Markdown file holding `ref`, if there is one */
    existing(ref: DocRef): ExistingFile | undefined {
        const file = this.byRef.get(docRefKey(ref))
        if (!file) return undefined
        return {
            fileId: file.id,
            name: file.name,
            storedHash: file.appProperties?.[HASH_PROPERTY],
        }
    }

    /**
     * Reserves `count` file ids in one call, for files created later with
     * `createFile`. An id that ends up unused is simply never used.
     */
    async reserveIds(count: number): Promise<string[]> {
        if (count === 0) return []
        if (count > MAX_GENERATED_IDS)
            throw new Error(
                `Cannot reserve ${count} file ids at once (at most ${MAX_GENERATED_IDS})`
            )
        const { data } = await withRetry(
            () =>
                this.drive.files.generateIds({
                    count,
                    space: "drive",
                    type: "files",
                }),
            { sleep: this.sleep, log: this.log }
        )
        const ids = data.ids ?? []
        if (ids.length !== count)
            throw new Error(
                `Drive returned ${ids.length} file ids, ${count} were asked for`
            )
        return ids
    }

    /**
     * Creates the Markdown file for `ref` under a reserved `fileId`, with its
     * content, properties and hash, in one call.
     */
    async createFile(
        ref: DocRef,
        name: string,
        fileId: string,
        markdown: string,
        hash: string
    ): Promise<void> {
        await withRetry(
            () =>
                this.drive.files.create({
                    supportsAllDrives: true,
                    fields: "id",
                    requestBody: {
                        id: fileId,
                        name,
                        parents: [this.folderId],
                        mimeType: MARKDOWN_MIME_TYPE,
                        appProperties: {
                            [KIND_PROPERTY]: ref.kind,
                            [ID_PROPERTY]: ref.id,
                            [HASH_PROPERTY]: hash,
                        },
                    },
                    media: { mimeType: MARKDOWN_MIME_TYPE, body: markdown },
                }),
            { sleep: this.sleep, log: this.log }
        )
    }

    /**
     * Replaces the file's content with `markdown` and records its `hash` —
     * and renames it when `newName` is given — in one call.
     */
    async updateFile(
        fileId: string,
        markdown: string,
        hash: string,
        newName?: string
    ): Promise<void> {
        const requestBody: drive_v3.Schema$File = {
            appProperties: { [HASH_PROPERTY]: hash },
        }
        if (newName !== undefined) requestBody.name = newName
        await withRetry(
            () =>
                this.drive.files.update({
                    fileId,
                    supportsAllDrives: true,
                    requestBody,
                    media: { mimeType: MARKDOWN_MIME_TYPE, body: markdown },
                }),
            { sleep: this.sleep, log: this.log }
        )
    }

    /**
     * Trashes every file of ours that is not a Markdown file (a leftover
     * Google Doc) or whose kind:id is not among `current`; files without
     * `owidRefKind` are left alone. Returns the trashed names.
     */
    async trashOrphans(current: DocRef[]): Promise<string[]> {
        const keep = new Set(current.map(docRefKey))
        const trashed: string[] = []
        for (const file of this.files) {
            const ref = refOf(file)
            if (!ref) continue
            const reason = orphanReason(file, ref, keep)
            if (!reason) continue
            await this.trash(file.id)
            this.log(`Trashed "${file.name}" (${file.id}): ${reason}`)
            trashed.push(file.name)
        }
        return trashed
    }

    private async trash(fileId: string): Promise<void> {
        await withRetry(
            () =>
                this.drive.files.update({
                    fileId,
                    supportsAllDrives: true,
                    requestBody: { trashed: true },
                }),
            { sleep: this.sleep, log: this.log }
        )
    }
}

/** Why a file of ours should go, or undefined when it is kept */
function orphanReason(
    file: LibraryFile,
    ref: DocRef,
    keep: Set<string>
): string | undefined {
    if (file.mimeType !== MARKDOWN_MIME_TYPE)
        return `not a Markdown file (${file.mimeType})`
    if (!keep.has(docRefKey(ref))) return `no current ${ref.kind} "${ref.id}"`
    return undefined
}

/** The library ref a file carries, or undefined for a file that isn't ours */
export function refOf(file: LibraryFile): DocRef | undefined {
    const kind = file.appProperties?.[KIND_PROPERTY]
    const id = file.appProperties?.[ID_PROPERTY]
    if (!isDocKind(kind) || !id) return undefined
    return { kind, id }
}

/** The ref of a file of ours that is a Markdown file — the only ones used */
function markdownRefOf(file: LibraryFile): DocRef | undefined {
    if (file.mimeType !== MARKDOWN_MIME_TYPE) return undefined
    return refOf(file)
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
