/*
 * The Google side, against an in-memory stand-in for the Drive API: plain
 * Markdown files found by appProperties; ids for missing files reserved in
 * one `generateIds` call and each such file created once, with its content;
 * existing files updated in place (media, hash and name in one call) or
 * skipped when the stored hash matches; leftover Google Docs and removed
 * items trashed; foreign files left alone; 429s retried with backoff; any
 * other failing upload stops the run naming the file.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/publish.test.ts
 */

import { describe, expect, test } from "vitest"
import type { drive_v3 } from "@googleapis/drive"
import type { ReferenceRegistries } from "./buildModel.js"
import { INDEX_DOC_TITLE, planLibraryDocs } from "./buildModel.js"
import { fixtureRegistries } from "./testFixtures.js"
import {
    markdownHash,
    publishReferenceLibrary,
    type PublishResult,
} from "./publish.js"
import { RETRY_DELAYS_MS } from "./retry.js"

const FOLDER = "folder-1"
const MARKDOWN = "text/markdown"
const GOOGLE_DOC = "application/vnd.google-apps.document"

/** A fake Drive file; `appProperties` undefined for a file that isn't ours */
interface FakeFile {
    id: string
    name: string
    mimeType: string
    appProperties?: Record<string, string>
    createdTime: string
    trashed: boolean
    /** The last media uploaded into it */
    content: string
}

/** An error shaped like googleapis' GaxiosError, as far as the retry looks */
function googleError(status: number, message: string): Error {
    return Object.assign(new Error(message), { code: status })
}

const fileUrl = (id: string): string =>
    `https://drive.google.com/file/d/${id}/view`

/** Just enough of Drive v3 (files.list / generateIds / create / update) */
class FakeDrive {
    readonly files: FakeFile[] = []
    /** The `count` of every successful files.generateIds call */
    readonly generateIdsCalls: number[] = []
    createCalls = 0
    /** files.update calls that carried media */
    uploadCalls = 0
    renameCalls = 0
    /** Calls that carried media: files.create and media files.update */
    mediaCalls = 0
    readonly sleeps: number[] = []
    private nextId = 1
    private nextGeneratedId = 1
    private readonly reserved = new Set<string>()
    /** Errors to throw on upcoming media calls, by call number */
    private readonly mediaFailures = new Map<number, Error>()
    /** Errors to throw on upcoming generateIds calls, by call number */
    private readonly generateIdsFailures = new Map<number, Error>()
    private generateIdsAttempts = 0

    /** Puts a file in the folder */
    addFile(
        name: string,
        appProperties?: Record<string, string>,
        options: {
            content?: string
            createdTime?: string
            mimeType?: string
        } = {}
    ): FakeFile {
        const file: FakeFile = {
            id: `file-${this.nextId++}`,
            name,
            mimeType: options.mimeType ?? MARKDOWN,
            appProperties,
            createdTime: options.createdTime ?? `2026-01-0${this.nextId}`,
            trashed: false,
            content: options.content ?? "",
        }
        this.files.push(file)
        return file
    }

    /** The live (non-trashed) file of ours for kind:id */
    fileFor(kind: string, id: string): FakeFile {
        const file = this.files.find(
            (f) =>
                !f.trashed &&
                f.appProperties?.owidRefKind === kind &&
                f.appProperties?.owidRefId === id
        )
        if (!file) throw new Error(`No file for ${kind}:${id}`)
        return file
    }

    failMedia(callNumber: number, error: Error): void {
        this.mediaFailures.set(callNumber, error)
    }

    failGenerateIds(callNumber: number, error: Error): void {
        this.generateIdsFailures.set(callNumber, error)
    }

    sleep = async (ms: number): Promise<void> => {
        this.sleeps.push(ms)
    }

    private countMediaCall(): void {
        this.mediaCalls++
        const failure = this.mediaFailures.get(this.mediaCalls)
        if (failure) throw failure
    }

    asDrive(): drive_v3.Drive {
        const files = {
            list: async (params: {
                q?: string
                fields?: string
                pageToken?: string
            }): Promise<{ data: drive_v3.Schema$FileList }> => {
                expect(params.q).toBe(
                    `'${FOLDER}' in parents and trashed = false`
                )
                expect(params.fields).toContain("mimeType")
                // Two pages, to exercise pagination
                const live = this.files.filter((f) => !f.trashed)
                const page = params.pageToken ? live.slice(2) : live.slice(0, 2)
                return {
                    data: {
                        files: page.map((f) => ({
                            id: f.id,
                            name: f.name,
                            mimeType: f.mimeType,
                            appProperties: f.appProperties
                                ? { ...f.appProperties }
                                : undefined,
                            createdTime: f.createdTime,
                        })),
                        nextPageToken:
                            !params.pageToken && live.length > 2
                                ? "page-2"
                                : undefined,
                    },
                }
            },
            generateIds: async (params: {
                count?: number
                space?: string
                type?: string
            }): Promise<{ data: drive_v3.Schema$GeneratedIds }> => {
                this.generateIdsAttempts++
                const failure = this.generateIdsFailures.get(
                    this.generateIdsAttempts
                )
                if (failure) throw failure
                expect(params.space).toBe("drive")
                expect(params.type).toBe("files")
                const count = params.count!
                expect(count).toBeGreaterThan(0)
                expect(count).toBeLessThanOrEqual(1000)
                this.generateIdsCalls.push(count)
                const ids: string[] = []
                for (let i = 0; i < count; i++) {
                    const id = `gen-${this.nextGeneratedId++}`
                    this.reserved.add(id)
                    ids.push(id)
                }
                return { data: { ids } }
            },
            create: async (params: {
                requestBody?: drive_v3.Schema$File
                media?: { mimeType?: string; body?: string }
            }): Promise<{ data: drive_v3.Schema$File }> => {
                // Never a file without its content
                expect(params.media?.mimeType).toBe(MARKDOWN)
                expect(params.media?.body).toBeTruthy()
                const body = params.requestBody!
                expect(body.parents).toEqual([FOLDER])
                expect(body.mimeType).toBe(MARKDOWN)
                expect(this.reserved.has(body.id!)).toBe(true)
                this.countMediaCall()
                this.createCalls++
                this.reserved.delete(body.id!)
                this.files.push({
                    id: body.id!,
                    name: body.name!,
                    mimeType: body.mimeType!,
                    appProperties: {
                        ...(body.appProperties as Record<string, string>),
                    },
                    createdTime: `2026-10-${String(this.createCalls).padStart(2, "0")}`,
                    trashed: false,
                    content: params.media!.body!,
                })
                return { data: { id: body.id } }
            },
            update: async (params: {
                fileId?: string
                requestBody?: drive_v3.Schema$File
                media?: { mimeType?: string; body?: string }
            }): Promise<{ data: drive_v3.Schema$File }> => {
                if (params.media) {
                    expect(params.media.mimeType).toBe(MARKDOWN)
                    this.countMediaCall()
                    this.uploadCalls++
                }
                const file = this.files.find((f) => f.id === params.fileId)
                if (!file) throw googleError(404, "File not found")
                const body = params.requestBody ?? {}
                if (body.name) {
                    this.renameCalls++
                    file.name = body.name
                }
                if (body.trashed) file.trashed = true
                // Drive merges appProperties: keys sent are set, others kept
                if (body.appProperties)
                    file.appProperties = {
                        ...file.appProperties,
                        ...(body.appProperties as Record<string, string>),
                    }
                if (params.media) file.content = params.media.body!
                return { data: {} }
            },
        }
        return { files } as unknown as drive_v3.Drive
    }
}

async function publish(
    fake: FakeDrive,
    registries: ReferenceRegistries = fixtureRegistries,
    log: string[] = []
): Promise<PublishResult> {
    return publishReferenceLibrary(registries, {
        folderId: FOLDER,
        generatedAt: new Date("2026-10-07T12:00:00Z"),
        commitSha: "abc1234",
        driveClient: fake.asDrive(),
        sleep: fake.sleep,
        log: (message) => log.push(message),
    })
}

const PLANNED = planLibraryDocs(fixtureRegistries)
const NAMES = PLANNED.map((doc) => doc.docTitle)

/** The fixture registries with the publishing guide's intro changed */
const withPublishingChanged: ReferenceRegistries = {
    ...fixtureRegistries,
    guides: fixtureRegistries.guides.map((guide) =>
        guide.id === "publishing"
            ? {
                  ...guide,
                  prose: {
                      intro: "The steps from draft to live page.\n\n1. Register the doc.\n2. Preview it.\n3. Publish it.",
                  },
              }
            : guide
    ),
}

describe(publishReferenceLibrary, () => {
    test("empty folder: one generateIds call for all files, each created once as Markdown with content, hash and properties", async () => {
        const fake = new FakeDrive()
        const result = await publish(fake)
        expect(fake.generateIdsCalls).toEqual([PLANNED.length])
        expect(fake.createCalls).toBe(PLANNED.length)
        expect(fake.uploadCalls).toBe(0)
        expect(fake.files.map((f) => f.name)).toEqual(NAMES)
        expect(fake.files.every((f) => f.mimeType === MARKDOWN)).toBe(true)
        expect(result.written).toEqual(NAMES)
        expect(result.created).toEqual(NAMES)
        expect(result.skipped).toEqual([])
        expect(result.trashed).toEqual([])
        const index = fake.fileFor("index", "index")
        expect(index.name).toBe("owid-writing-reference-index.md")
        expect(index.id).toMatch(/^gen-/)
        expect(result.indexUrl).toBe(fileUrl(index.id))
        const publishing = fake.fileFor("guide", "publishing")
        expect(publishing.name).toBe("guide-publishing.md")
        expect(publishing.content).toBe(
            `# Publishing a document\n\nThe steps from draft to live page.\n\n1. Register the doc.\n2. Preview it.\n\nBack to the index: [${INDEX_DOC_TITLE}](${fileUrl(index.id)})\n`
        )
        expect(publishing.appProperties).toEqual({
            owidRefKind: "guide",
            owidRefId: "publishing",
            owidRefHash: markdownHash(publishing.content),
        })
    })

    test("links resolve to the reserved ids of their targets", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const refs = fake.fileFor("guide", "refs")
        const chart = fake.fileFor("component", "chart")
        expect(chart.content).toContain(
            `See [Refs and footnotes](${fileUrl(refs.id)}) for sources`
        )
        expect(fake.fileFor("index", "index").content).toContain(
            fileUrl(chart.id)
        )
    })

    test("re-run with nothing changed: no generateIds, no create, no media upload", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(fake.generateIdsCalls).toEqual([PLANNED.length])
        expect(fake.createCalls).toBe(PLANNED.length)
        expect(fake.uploadCalls).toBe(0)
        expect(result.written).toEqual([])
        expect(result.created).toEqual([])
        expect(result.skipped).toEqual(NAMES)
        expect(log).toContain(
            "owid-writing-reference-index.md: unchanged, skipped"
        )
        expect(log.at(-1)).toBe(
            `Done: 0 written (0 created), ${PLANNED.length} skipped (unchanged), 0 trashed`
        )
    })

    test("one item changed: files.update with the new media and hash on the same file id, others untouched", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const before = fake.files.map((f) => ({ ...f }))
        const result = await publish(fake, withPublishingChanged)
        expect(result.written).toEqual(["guide-publishing.md"])
        expect(result.created).toEqual([])
        expect(result.skipped).toHaveLength(PLANNED.length - 1)
        expect(fake.uploadCalls).toBe(1)
        expect(fake.createCalls).toBe(PLANNED.length)
        expect(fake.files.map((f) => f.id)).toEqual(before.map((f) => f.id))
        const publishing = fake.fileFor("guide", "publishing")
        expect(publishing.content).toContain(
            "\n2. Preview it.\n3. Publish it.\n"
        )
        expect(publishing.appProperties?.owidRefHash).toBe(
            markdownHash(publishing.content)
        )
        for (const file of fake.files.filter((f) => f.id !== publishing.id))
            expect(file).toEqual(before.find((f) => f.id === file.id))
    })

    test("new item added: an id is reserved for that file only, and it is created with its content", async () => {
        const fake = new FakeDrive()
        const withoutPublishing: ReferenceRegistries = {
            ...fixtureRegistries,
            guides: fixtureRegistries.guides.filter(
                (guide) => guide.id !== "publishing"
            ),
        }
        await publish(fake, withoutPublishing)
        const result = await publish(fake)
        expect(fake.generateIdsCalls).toEqual([PLANNED.length - 1, 1])
        expect(result.created).toEqual(["guide-publishing.md"])
        const publishing = fake.fileFor("guide", "publishing")
        expect(publishing.content).toMatch(/^# Publishing a document\n/)
        // The index lists the new guide, so it is updated in place
        expect(result.written).toContain("owid-writing-reference-index.md")
        expect(fake.fileFor("index", "index").content).toContain(
            fileUrl(publishing.id)
        )
    })

    test("a leftover Google Doc of ours is trashed, and a Markdown file is created for its ref", async () => {
        const fake = new FakeDrive()
        const leftover = fake.addFile(
            "{.chart} Chart — OWID writing reference",
            { owidRefKind: "component", owidRefId: "chart" },
            { content: "converted doc", mimeType: GOOGLE_DOC }
        )
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(leftover.trashed).toBe(true)
        expect(leftover.content).toBe("converted doc")
        expect(result.trashed).toEqual([leftover.name])
        expect(
            log.some((m) =>
                m.startsWith(
                    `Trashed "${leftover.name}" (${leftover.id}): not a Markdown file`
                )
            )
        ).toBe(true)
        const chart = fake.fileFor("component", "chart")
        expect(chart.id).not.toBe(leftover.id)
        expect(chart.mimeType).toBe(MARKDOWN)
        expect(chart.content).toMatch(/^# Chart\n/)
        expect(result.created).toContain("component-chart.md")
    })

    test("a foreign file is left alone, even one named like ours", async () => {
        const fake = new FakeDrive()
        const handUploaded = fake.addFile("component-chart.md", undefined, {
            content: "Hand-uploaded test",
        })
        const notes = fake.addFile("Meeting notes", undefined, {
            content: "Keep me",
            mimeType: GOOGLE_DOC,
        })
        const result = await publish(fake)
        for (const foreign of [handUploaded, notes]) {
            expect(foreign.trashed).toBe(false)
            expect(foreign.appProperties).toBeUndefined()
        }
        expect(handUploaded.content).toBe("Hand-uploaded test")
        expect(notes.content).toBe("Keep me")
        expect(result.trashed).toEqual([])
        expect(fake.fileFor("component", "chart").id).not.toBe(handUploaded.id)
    })

    test("a file of a removed item is trashed and logged", async () => {
        const fake = new FakeDrive()
        const orphan = fake.addFile(
            "component-old-block.md",
            { owidRefKind: "component", owidRefId: "old-block" },
            { content: "old" }
        )
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(result.trashed).toEqual([orphan.name])
        expect(orphan.trashed).toBe(true)
        expect(orphan.content).toBe("old")
        expect(log).toContain(
            `Trashed "${orphan.name}" (${orphan.id}): no current component "old-block"`
        )
    })

    test("a file of ours under another name is renamed and re-uploaded in one call, even when its content is unchanged", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const chart = fake.fileFor("component", "chart")
        chart.name = "{.chart} Chart — OWID writing reference"
        const result = await publish(fake)
        expect(chart.name).toBe("component-chart.md")
        expect(fake.renameCalls).toBe(1)
        expect(fake.uploadCalls).toBe(1)
        expect(result.written).toEqual(["component-chart.md"])
        expect(result.created).toEqual([])
    })

    test("a file without a stored hash (written before) is uploaded in place", async () => {
        const fake = new FakeDrive()
        const old = fake.addFile(
            "component-chart.md",
            { owidRefKind: "component", owidRefId: "chart" },
            { content: "old content" }
        )
        const result = await publish(fake)
        expect(result.written).toContain("component-chart.md")
        expect(result.created).not.toContain("component-chart.md")
        expect(old.content).toMatch(/^# Chart\n/)
        expect(fake.generateIdsCalls).toEqual([PLANNED.length - 1])
    })

    test("two files for one item: the older one is used, the other is named in a warning", async () => {
        const fake = new FakeDrive()
        const newer = fake.addFile(
            "component-chart.md",
            { owidRefKind: "component", owidRefId: "chart" },
            { createdTime: "2026-05-01" }
        )
        const older = fake.addFile(
            "component-chart (copy).md",
            { owidRefKind: "component", owidRefId: "chart" },
            { createdTime: "2026-01-01" }
        )
        const olderName = older.name
        const log: string[] = []
        await publish(fake, fixtureRegistries, log)
        expect(log.find((m) => m.startsWith("Warning:"))).toBe(
            `Warning: "${newer.name}" (${newer.id}) duplicates "${olderName}" (${older.id}) for component:chart; using the older one`
        )
        // The older one was renamed and written; the newer one left as it was
        expect(older.name).toBe("component-chart.md")
        expect(older.content).toContain("ArchieML tag: `{.chart}`")
        expect(newer.content).toBe("")
        expect(newer.trashed).toBe(false)
    })

    test("no file is ever created without its content", async () => {
        // The fake rejects a create without media; a full first run plus a
        // re-run with one new file exercise every create path
        const fake = new FakeDrive()
        await publish(fake)
        fake.fileFor("guide", "refs").trashed = true
        await publish(fake)
        expect(fake.createCalls).toBe(PLANNED.length + 1)
        expect(fake.files.every((f) => f.trashed || f.content !== "")).toBe(
            true
        )
    })

    test("a 429 then a 503 on the same upload are retried with growing backoff and the run completes", async () => {
        const fake = new FakeDrive()
        fake.failMedia(2, googleError(429, "Rate Limit Exceeded"))
        fake.failMedia(3, googleError(503, "Service Unavailable"))
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(result.written).toHaveLength(PLANNED.length)
        expect(fake.files).toHaveLength(PLANNED.length)
        expect(fake.sleeps).toEqual([RETRY_DELAYS_MS[0], RETRY_DELAYS_MS[1]])
        expect(log.filter((m) => m.includes("retrying"))).toEqual([
            "Google returned 429; retrying in 2s (1/3)",
            "Google returned 503; retrying in 4s (2/3)",
        ])
    })

    test("a 429 on an in-place update is retried too", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        fake.failMedia(
            PLANNED.length + 1,
            googleError(429, "Rate Limit Exceeded")
        )
        const result = await publish(fake, withPublishingChanged)
        expect(result.written).toEqual(["guide-publishing.md"])
        expect(fake.sleeps).toEqual([RETRY_DELAYS_MS[0]])
    })

    test("a 429 on generateIds is retried too", async () => {
        const fake = new FakeDrive()
        fake.failGenerateIds(1, googleError(429, "Rate Limit Exceeded"))
        await publish(fake)
        expect(fake.sleeps).toEqual([RETRY_DELAYS_MS[0]])
        expect(fake.generateIdsCalls).toEqual([PLANNED.length])
    })

    test("a 429 that persists fails after three retries, naming the file", async () => {
        const fake = new FakeDrive()
        for (const call of [1, 2, 3, 4])
            fake.failMedia(call, googleError(429, "Rate Limit Exceeded"))
        await expect(publish(fake)).rejects.toThrow(
            'Upload failed for "owid-writing-reference-index.md": Rate Limit Exceeded'
        )
        expect(fake.sleeps).toEqual(RETRY_DELAYS_MS)
        expect(fake.mediaCalls).toBe(4)
        expect(fake.files).toEqual([])
    })

    test("any other upload error stops the run with the file and Google's message, no retry", async () => {
        const fake = new FakeDrive()
        // 1: the index, 2: the first component
        fake.failMedia(2, googleError(400, "Bad Request"))
        await expect(publish(fake)).rejects.toThrow(
            'Upload failed for "component-callout.md": Bad Request'
        )
        expect(fake.mediaCalls).toBe(2)
        expect(fake.sleeps).toEqual([])
        // Only the file that was fully written exists; nothing empty
        expect(fake.files.map((f) => f.name)).toEqual([
            "owid-writing-reference-index.md",
        ])
    })
})
