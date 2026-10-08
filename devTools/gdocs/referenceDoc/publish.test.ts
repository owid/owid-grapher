/*
 * The Google side, against an in-memory stand-in for the Drive API:
 * documents are found by appProperties and created, renamed or trashed as
 * the registries dictate; each document's Markdown is uploaded as the file's
 * media with its hash in the same call, and skipped when the stored hash
 * matches; 429s are retried with backoff; any other failing upload stops the
 * run naming the document.
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

/** A fake Drive file; `appProperties` undefined for a file that isn't ours */
interface FakeFile {
    id: string
    name: string
    appProperties?: Record<string, string>
    createdTime: string
    trashed: boolean
    /** The last media uploaded into it, and its media type */
    content: string
    mimeType?: string
}

/** An error shaped like googleapis' GaxiosError, as far as the retry looks */
function googleError(status: number, message: string): Error {
    return Object.assign(new Error(message), { code: status })
}

/** Just enough of Drive v3 (files.list / create / update) for the publisher */
class FakeDrive {
    readonly files: FakeFile[] = []
    createCalls = 0
    renameCalls = 0
    uploadCalls = 0
    readonly sleeps: number[] = []
    private nextId = 1
    /** Errors to throw on upcoming media uploads, by call number */
    private readonly uploadFailures = new Map<number, Error>()
    /** Errors to throw on upcoming files.create calls, by call number */
    private readonly createFailures = new Map<number, Error>()

    /** Puts a file in the folder */
    addFile(
        name: string,
        appProperties?: Record<string, string>,
        options: { content?: string; createdTime?: string } = {}
    ): FakeFile {
        const file: FakeFile = {
            id: `file-${this.nextId++}`,
            name,
            appProperties,
            createdTime: options.createdTime ?? `2026-01-0${this.nextId}`,
            trashed: false,
            content: options.content ?? "",
        }
        this.files.push(file)
        return file
    }

    fileFor(kind: string, id: string): FakeFile {
        const file = this.files.find(
            (f) =>
                f.appProperties?.owidRefKind === kind &&
                f.appProperties?.owidRefId === id
        )
        if (!file) throw new Error(`No file for ${kind}:${id}`)
        return file
    }

    failUpload(callNumber: number, error: Error): void {
        this.uploadFailures.set(callNumber, error)
    }

    failCreate(callNumber: number, error: Error): void {
        this.createFailures.set(callNumber, error)
    }

    sleep = async (ms: number): Promise<void> => {
        this.sleeps.push(ms)
    }

    asDrive(): drive_v3.Drive {
        const files = {
            list: async (params: {
                q?: string
                pageToken?: string
            }): Promise<{ data: drive_v3.Schema$FileList }> => {
                expect(params.q).toBe(
                    `'${FOLDER}' in parents and trashed = false`
                )
                // Two pages, to exercise pagination
                const live = this.files.filter((f) => !f.trashed)
                const page = params.pageToken ? live.slice(2) : live.slice(0, 2)
                return {
                    data: {
                        files: page.map((f) => ({
                            id: f.id,
                            name: f.name,
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
            create: async (params: {
                requestBody?: drive_v3.Schema$File
            }): Promise<{ data: drive_v3.Schema$File }> => {
                this.createCalls++
                const failure = this.createFailures.get(this.createCalls)
                if (failure) throw failure
                const body = params.requestBody!
                expect(body.parents).toEqual([FOLDER])
                expect(body.mimeType).toBe(
                    "application/vnd.google-apps.document"
                )
                const file = this.addFile(
                    body.name!,
                    body.appProperties as Record<string, string>
                )
                return { data: { id: file.id } }
            },
            update: async (params: {
                fileId?: string
                requestBody?: drive_v3.Schema$File
                media?: { mimeType?: string; body?: string }
            }): Promise<{ data: drive_v3.Schema$File }> => {
                if (params.media) {
                    this.uploadCalls++
                    const failure = this.uploadFailures.get(this.uploadCalls)
                    if (failure) throw failure
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
                if (params.media) {
                    file.content = params.media.body!
                    file.mimeType = params.media.mimeType
                }
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

describe(publishReferenceLibrary, () => {
    test("empty folder: creates the index and one document per item, then uploads each as Markdown with its hash", async () => {
        const fake = new FakeDrive()
        const result = await publish(fake)
        expect(fake.files.map((f) => f.name)).toEqual(
            PLANNED.map((doc) => doc.docTitle)
        )
        expect(result.written).toEqual(PLANNED.map((doc) => doc.docTitle))
        expect(result.skipped).toEqual([])
        expect(result.trashed).toEqual([])
        const index = fake.fileFor("index", "index")
        expect(result.indexUrl).toBe(
            `https://docs.google.com/document/d/${index.id}`
        )
        const publishing = fake.fileFor("guide", "publishing")
        expect(publishing.mimeType).toBe("text/markdown")
        expect(publishing.content).toBe(
            `# Publishing a document\n\nThe steps from draft to live page.\n\n1. Register the doc.\n2. Preview it.\n\nBack to the index: [${INDEX_DOC_TITLE}](https://docs.google.com/document/d/${index.id})\n`
        )
        expect(publishing.appProperties).toEqual({
            owidRefKind: "guide",
            owidRefId: "publishing",
            owidRefHash: markdownHash(publishing.content),
        })
        // The media type is part of the hash: the text/plain fallback re-uploads
        expect(publishing.appProperties?.owidRefHash).toBe(
            markdownHash(publishing.content, "text/markdown")
        )
        expect(publishing.appProperties?.owidRefHash).not.toBe(
            markdownHash(publishing.content, "text/plain")
        )
    })

    test("mentions link to the target document's URL", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const refs = fake.fileFor("guide", "refs")
        expect(fake.fileFor("component", "chart").content).toContain(
            `See [Refs and footnotes](https://docs.google.com/document/d/${refs.id}) for sources`
        )
    })

    test("re-run with nothing changed: every document is skipped, no upload at all", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(fake.uploadCalls).toBe(PLANNED.length)
        expect(fake.createCalls).toBe(PLANNED.length)
        expect(result.written).toEqual([])
        expect(result.skipped).toEqual(PLANNED.map((doc) => doc.docTitle))
        expect(log).toContain(`${INDEX_DOC_TITLE}: unchanged, skipped`)
        expect(log.at(-1)).toBe(
            `Done: 0 written, ${PLANNED.length} skipped (unchanged), 0 trashed`
        )
    })

    test("re-run with one sidecar changed: only that document is uploaded, with its new hash, file ids unchanged", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const idsBefore = fake.files.map((f) => f.id)
        const changed: ReferenceRegistries = {
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
        const result = await publish(fake, changed)
        expect(result.written).toEqual([
            "Publishing a document (guide) — OWID writing reference",
        ])
        expect(result.skipped).toHaveLength(PLANNED.length - 1)
        expect(fake.uploadCalls).toBe(PLANNED.length + 1)
        expect(fake.files.map((f) => f.id)).toEqual(idsBefore)
        const publishing = fake.fileFor("guide", "publishing")
        expect(publishing.content).toContain(
            "\n2. Preview it.\n3. Publish it.\n"
        )
        expect(publishing.appProperties?.owidRefHash).toBe(
            markdownHash(publishing.content)
        )
    })

    test("a document without a stored hash (written before) is uploaded", async () => {
        const fake = new FakeDrive()
        const old = fake.addFile(
            "{.chart} Chart — OWID writing reference",
            { owidRefKind: "component", owidRefId: "chart" },
            { content: "old Docs API content" }
        )
        const result = await publish(fake)
        expect(result.written).toContain(old.name)
        expect(old.content).toMatch(/^# Chart\n/)
    })

    test("a retitled component keeps its document: found by appProperties, renamed, re-uploaded", async () => {
        const fake = new FakeDrive()
        await publish(fake)
        const chartId = fake.fileFor("component", "chart").id
        const retitled: ReferenceRegistries = {
            ...fixtureRegistries,
            components: fixtureRegistries.components.map((component) =>
                component.id === "chart"
                    ? { ...component, title: "Grapher chart" }
                    : component
            ),
        }
        const result = await publish(fake, retitled)
        const chart = fake.fileFor("component", "chart")
        expect(chart.id).toBe(chartId)
        expect(chart.name).toBe(
            "{.chart} Grapher chart — OWID writing reference"
        )
        expect(fake.renameCalls).toBe(1)
        expect(fake.createCalls).toBe(PLANNED.length)
        expect(result.written).toContain(
            "{.chart} Grapher chart — OWID writing reference"
        )
        expect(chart.content).toMatch(/^# Grapher chart\n\nArchieML tag/)
    })

    test("a document for a removed component is trashed and logged; a foreign file is untouched", async () => {
        const fake = new FakeDrive()
        const orphan = fake.addFile(
            "{.old-block} Old block — OWID writing reference",
            { owidRefKind: "component", owidRefId: "old-block" },
            { content: "old" }
        )
        const foreign = fake.addFile("Meeting notes", undefined, {
            content: "Keep me",
        })
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(result.trashed).toEqual([orphan.name])
        expect(orphan.trashed).toBe(true)
        expect(log.some((m) => m.includes(`Trashed "${orphan.name}"`))).toBe(
            true
        )
        expect(foreign.trashed).toBe(false)
        expect(foreign.content).toBe("Keep me")
        expect(orphan.content).toBe("old")
    })

    test("two documents for one item: the older one is used, the other is named in a warning", async () => {
        const fake = new FakeDrive()
        const newer = fake.addFile(
            "{.chart} Chart — OWID writing reference",
            { owidRefKind: "component", owidRefId: "chart" },
            { createdTime: "2026-05-01" }
        )
        const older = fake.addFile(
            "{.chart} Chart (copy) — OWID writing reference",
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
        expect(older.name).toBe("{.chart} Chart — OWID writing reference")
        expect(older.content).toContain("ArchieML tag: `{.chart}`")
        expect(newer.content).toBe("")
        expect(newer.trashed).toBe(false)
    })

    test("a 429 then a 503 on the same upload are retried with growing backoff and the run completes", async () => {
        const fake = new FakeDrive()
        fake.failUpload(2, googleError(429, "Rate Limit Exceeded"))
        fake.failUpload(3, googleError(503, "Service Unavailable"))
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(result.written).toHaveLength(PLANNED.length)
        expect(fake.sleeps).toEqual([RETRY_DELAYS_MS[0], RETRY_DELAYS_MS[1]])
        expect(log.filter((m) => m.includes("retrying"))).toEqual([
            "Google returned 429; retrying in 2s (1/3)",
            "Google returned 503; retrying in 4s (2/3)",
        ])
    })

    test("a 429 that persists fails after three retries, naming the document", async () => {
        const fake = new FakeDrive()
        for (const call of [1, 2, 3, 4])
            fake.failUpload(call, googleError(429, "Rate Limit Exceeded"))
        await expect(publish(fake)).rejects.toThrow(
            `Upload failed for "${INDEX_DOC_TITLE}": Rate Limit Exceeded`
        )
        expect(fake.sleeps).toEqual(RETRY_DELAYS_MS)
        expect(fake.uploadCalls).toBe(4)
    })

    test("a 429 on files.create is retried too", async () => {
        const fake = new FakeDrive()
        fake.failCreate(1, googleError(429, "Rate Limit Exceeded"))
        await publish(fake)
        expect(fake.sleeps).toEqual([RETRY_DELAYS_MS[0]])
        expect(fake.files).toHaveLength(PLANNED.length)
    })

    test("any other upload error stops the run with the document and Google's message, no retry", async () => {
        const fake = new FakeDrive()
        // 1: the index, 2: the first component
        fake.failUpload(2, googleError(400, "Unsupported conversion"))
        await expect(publish(fake)).rejects.toThrow(
            'Upload failed for "{.callout} Callout — OWID writing reference": Unsupported conversion'
        )
        expect(fake.uploadCalls).toBe(2)
        expect(fake.sleeps).toEqual([])
    })
})
