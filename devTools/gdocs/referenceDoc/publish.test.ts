/*
 * The Google side, against in-memory stand-ins for the Docs and Drive APIs:
 * documents are found by appProperties and created, renamed or trashed as
 * the registries dictate; unchanged documents are skipped; 429s are retried
 * with backoff; any other failing batchUpdate stops the run naming the
 * document and the chunk.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/publish.test.ts
 */

import { describe, expect, test } from "vitest"
import type { docs_v1 } from "@googleapis/docs"
import type { drive_v3 } from "@googleapis/drive"
import type { ReferenceRegistries } from "./buildModel.js"
import { INDEX_DOC_TITLE, planLibraryDocs } from "./buildModel.js"
import { fixtureRegistries } from "./testFixtures.js"
import { emptyTableSpan } from "./renderDocsRequests.js"
import { publishReferenceLibrary, type PublishResult } from "./publish.js"
import { RETRY_DELAYS_MS } from "./retry.js"

const FOLDER = "folder-1"

/** A fake Drive file; `appProperties` undefined for a file that isn't ours */
interface FakeFile {
    id: string
    name: string
    appProperties?: Record<string, string>
    createdTime: string
    trashed: boolean
}

/** One fake Google Doc: a single tab whose body is paragraphs and empty tables */
interface FakeDoc {
    id: string
    content: docs_v1.Schema$StructuralElement[]
    /** Pass 2 has started: cell text shifts indices the fake does not re-lay out */
    fillingTables?: boolean
}

/** An error shaped like googleapis' GaxiosError, as far as the retry looks */
function googleError(status: number, message: string): Error {
    return Object.assign(new Error(message), { code: status })
}

/**
 * Just enough of Drive v3 (files.list / create / update) and Docs v1
 * (documents.get / batchUpdate) for the publisher. Document indices follow
 * the API's documented layout — text advances by its length, insertTable
 * adds a newline then an empty table with one empty paragraph per cell.
 */
class FakeGoogle {
    readonly files: FakeFile[] = []
    readonly docs = new Map<string, FakeDoc>()
    batchUpdateCalls = 0
    createCalls = 0
    renameCalls = 0
    readonly sleeps: number[] = []
    private nextId = 1
    /** Errors to throw on upcoming batchUpdate calls, by call number */
    private readonly failures = new Map<number, Error>()
    /** Errors to throw on upcoming files.create calls, by call number */
    private readonly createFailures = new Map<number, Error>()

    /** Puts a file in the folder; a Google Doc goes with it */
    addFile(
        name: string,
        appProperties?: Record<string, string>,
        options: { text?: string; createdTime?: string } = {}
    ): FakeFile {
        const id = `file-${this.nextId++}`
        const file: FakeFile = {
            id,
            name,
            appProperties,
            createdTime: options.createdTime ?? `2026-01-0${this.nextId}`,
            trashed: false,
        }
        this.files.push(file)
        this.docs.set(id, {
            id,
            content: paragraphElements(options.text ?? ""),
        })
        return file
    }

    file(name: string): FakeFile {
        const file = this.files.find((f) => f.name === name)
        if (!file) throw new Error(`No file named "${name}"`)
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

    /** The doc body as text, tables as [table], without the body's final newline */
    docText(fileId: string): string {
        return this.doc(fileId).content.map(elementText).join("").slice(0, -1)
    }

    failBatchUpdate(callNumber: number, error: Error): void {
        this.failures.set(callNumber, error)
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
                            appProperties: f.appProperties,
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
            }): Promise<{ data: drive_v3.Schema$File }> => {
                const file = this.files.find((f) => f.id === params.fileId)
                if (!file) throw googleError(404, "File not found")
                if (params.requestBody?.name) {
                    this.renameCalls++
                    file.name = params.requestBody.name
                }
                if (params.requestBody?.trashed) file.trashed = true
                return { data: {} }
            },
        }
        return { files } as unknown as drive_v3.Drive
    }

    asDocs(): docs_v1.Docs {
        const documents = {
            get: async (params: {
                documentId?: string
            }): Promise<{ data: docs_v1.Schema$Document }> => {
                const doc = this.doc(params.documentId!)
                return {
                    data: {
                        documentId: doc.id,
                        tabs: [
                            {
                                tabProperties: {
                                    tabId: `${doc.id}.t0`,
                                    index: 0,
                                },
                                documentTab: { body: { content: doc.content } },
                            },
                        ],
                    },
                }
            },
            batchUpdate: async (params: {
                documentId?: string
                requestBody?: docs_v1.Schema$BatchUpdateDocumentRequest
            }): Promise<{
                data: docs_v1.Schema$BatchUpdateDocumentResponse
            }> => {
                this.batchUpdateCalls++
                const failure = this.failures.get(this.batchUpdateCalls)
                if (failure) throw failure
                const doc = this.doc(params.documentId!)
                for (const request of params.requestBody?.requests ?? [])
                    this.apply(doc, request)
                return { data: { replies: [] } }
            },
        }
        return { documents } as unknown as docs_v1.Docs
    }

    private doc(fileId: string): FakeDoc {
        const doc = this.docs.get(fileId)
        if (!doc) throw googleError(404, `No document ${fileId}`)
        return doc
    }

    private apply(doc: FakeDoc, request: docs_v1.Schema$Request): void {
        const tabId = `${doc.id}.t0`
        const endIndex = (): number => doc.content.at(-1)?.endIndex ?? 2
        if (request.deleteContentRange) {
            const range = request.deleteContentRange.range!
            expect(range.tabId).toBe(tabId)
            expect(range.startIndex).toBe(1)
            expect(range.endIndex).toBe(endIndex() - 1)
            doc.content = paragraphElements("")
            doc.fillingTables = false
            return
        }
        if (request.insertText) {
            const { text, endOfSegmentLocation, location } = request.insertText
            if (endOfSegmentLocation) {
                expect(endOfSegmentLocation.tabId).toBe(tabId)
                appendText(doc, text!)
            } else {
                // Pass 2: cell text goes into the cell at that index
                expect(location!.tabId).toBe(tabId)
                fillCell(doc, location!.index!, text!)
                doc.fillingTables = true
            }
            return
        }
        if (request.insertTable) {
            const { rows, columns } = request.insertTable
            const start = endIndex()
            const span = emptyTableSpan(rows!, columns!)
            doc.content.push(tableElement(start, rows!, columns!))
            doc.content.push({
                startIndex: start + span,
                endIndex: start + span + 1,
                paragraph: { elements: [{ textRun: { content: "\n" } }] },
            })
            return
        }
        const range =
            request.updateTextStyle?.range ??
            request.updateParagraphStyle?.range ??
            request.createParagraphBullets?.range ??
            request.deleteParagraphBullets?.range
        if (range) {
            expect(range.tabId).toBe(tabId)
            if (!doc.fillingTables)
                expect(range.endIndex).toBeLessThanOrEqual(endIndex())
        }
    }
}

/** A body holding `text` plus the trailing newline every body has */
function paragraphElements(text: string): docs_v1.Schema$StructuralElement[] {
    return [
        {
            startIndex: 1,
            endIndex: 1 + text.length + 1,
            paragraph: { elements: [{ textRun: { content: text + "\n" } }] },
        },
    ]
}

function appendText(doc: FakeDoc, text: string): void {
    const last = doc.content.at(-1)!
    const run = last.paragraph!.elements![0].textRun!
    // Insert before the trailing newline
    run.content = run.content!.slice(0, -1) + text + "\n"
    last.endIndex = last.endIndex! + text.length
}

/** Pass 2 in the fake: the text lands in the cell's paragraph (indices are not re-laid out) */
function fillCell(doc: FakeDoc, index: number, text: string): void {
    for (const element of doc.content)
        for (const row of element.table?.tableRows ?? [])
            for (const cell of row.tableCells ?? []) {
                const paragraph = cell.content![0]
                if (paragraph.startIndex === index) {
                    const run = paragraph.paragraph!.elements![0].textRun!
                    run.content = text + run.content!
                    return
                }
            }
    throw new Error(`No cell starts at ${index}`)
}

function elementText(element: docs_v1.Schema$StructuralElement): string {
    if (element.paragraph)
        return element.paragraph
            .elements!.map((e) => e.textRun!.content)
            .join("")
    return "[table]"
}

/** A fetched empty table, laid out as the Docs API does */
function tableElement(
    startIndex: number,
    rows: number,
    columns: number
): docs_v1.Schema$StructuralElement {
    let index = startIndex + 1
    const tableRows: docs_v1.Schema$TableRow[] = []
    for (let r = 0; r < rows; r++) {
        const rowStart = index++
        const tableCells: docs_v1.Schema$TableCell[] = []
        for (let c = 0; c < columns; c++) {
            const cellStart = index++
            tableCells.push({
                startIndex: cellStart,
                endIndex: index + 1,
                content: [
                    {
                        startIndex: index,
                        endIndex: index + 1,
                        paragraph: {
                            elements: [{ textRun: { content: "\n" } }],
                        },
                    },
                ],
            })
            index++
        }
        tableRows.push({ startIndex: rowStart, endIndex: index, tableCells })
    }
    return {
        startIndex,
        endIndex: index + 1,
        table: { rows, columns, tableRows },
    }
}

async function publish(
    fake: FakeGoogle,
    registries: ReferenceRegistries = fixtureRegistries,
    log: string[] = []
): Promise<PublishResult> {
    return publishReferenceLibrary(registries, {
        folderId: FOLDER,
        generatedAt: new Date("2026-10-07T12:00:00Z"),
        commitSha: "abc1234",
        client: fake.asDocs(),
        driveClient: fake.asDrive(),
        sleep: fake.sleep,
        log: (message) => log.push(message),
    })
}

const PLANNED = planLibraryDocs(fixtureRegistries)

describe(publishReferenceLibrary, () => {
    test("empty folder: creates the index and one document per item, with appProperties, and writes them all", async () => {
        const fake = new FakeGoogle()
        const result = await publish(fake)
        expect(fake.files.map((f) => f.name)).toEqual(
            PLANNED.map((doc) => doc.docTitle)
        )
        expect(fake.files.map((f) => f.appProperties)).toEqual(
            PLANNED.map((doc) => ({ owidRefKind: doc.kind, owidRefId: doc.id }))
        )
        expect(result.written).toEqual(PLANNED.map((doc) => doc.docTitle))
        expect(result.skipped).toEqual([])
        expect(result.trashed).toEqual([])
        expect(result.indexUrl).toBe(
            `https://docs.google.com/document/d/${fake.file(INDEX_DOC_TITLE).id}`
        )
        // Content landed in the first tab: a guide with no tables, a component with one
        expect(fake.docText(fake.fileFor("guide", "publishing").id)).toBe(
            "Publishing a document\nThe steps from draft to live page.\nRegister the doc.\nPreview it.\nBack to the index: OWID writing reference — start here\n"
        )
        expect(fake.docText(fake.fileFor("component", "chart").id)).toContain(
            "ArchieML tag: {.chart}\n"
        )
        expect(fake.docText(fake.fileFor("component", "chart").id)).toContain(
            "[table]"
        )
    })

    test("re-run with nothing changed: every document is skipped, no batchUpdate at all", async () => {
        const fake = new FakeGoogle()
        await publish(fake)
        const callsAfterFirst = fake.batchUpdateCalls
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(fake.batchUpdateCalls).toBe(callsAfterFirst)
        expect(fake.createCalls).toBe(PLANNED.length)
        expect(result.written).toEqual([])
        expect(result.skipped).toEqual(PLANNED.map((doc) => doc.docTitle))
        expect(log.at(-1)).toBe(
            `Done: 0 written, ${PLANNED.length} skipped (unchanged), 0 trashed`
        )
    })

    test("re-run with one sidecar changed: only that document is rewritten, file ids unchanged", async () => {
        const fake = new FakeGoogle()
        await publish(fake)
        const idsBefore = fake.files.map((f) => f.id)
        const changed: ReferenceRegistries = {
            ...fixtureRegistries,
            guides: fixtureRegistries.guides.map((guide) =>
                guide.id === "publishing"
                    ? {
                          ...guide,
                          prose: {
                              intro: "The steps from draft to live page, revised.",
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
        expect(fake.files.map((f) => f.id)).toEqual(idsBefore)
        expect(fake.docText(fake.fileFor("guide", "publishing").id)).toBe(
            "Publishing a document\nThe steps from draft to live page, revised.\nBack to the index: OWID writing reference — start here\n"
        )
    })

    test("a retitled component keeps its document: found by appProperties, renamed, rewritten", async () => {
        const fake = new FakeGoogle()
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
        expect(fake.fileFor("component", "chart").id).toBe(chartId)
        expect(fake.fileFor("component", "chart").name).toBe(
            "{.chart} Grapher chart — OWID writing reference"
        )
        expect(fake.renameCalls).toBe(1)
        expect(fake.createCalls).toBe(PLANNED.length)
        expect(result.written).toContain(
            "{.chart} Grapher chart — OWID writing reference"
        )
        expect(fake.docText(chartId)).toContain("Grapher chart\nArchieML tag")
    })

    test("a document for a removed component is trashed and logged; a foreign file is untouched", async () => {
        const fake = new FakeGoogle()
        const orphan = fake.addFile(
            "{.old-block} Old block — OWID writing reference",
            { owidRefKind: "component", owidRefId: "old-block" },
            { text: "old" }
        )
        const foreign = fake.addFile("Meeting notes", undefined, {
            text: "Keep me",
        })
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(result.trashed).toEqual([orphan.name])
        expect(fake.files.find((f) => f.id === orphan.id)?.trashed).toBe(true)
        expect(log.some((m) => m.includes(`Trashed "${orphan.name}"`))).toBe(
            true
        )
        expect(fake.files.find((f) => f.id === foreign.id)?.trashed).toBe(false)
        expect(fake.docText(foreign.id)).toBe("Keep me")
        expect(fake.docText(orphan.id)).toBe("old")
    })

    test("two documents for one item: the older one is used, the other is named in a warning", async () => {
        const fake = new FakeGoogle()
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
        expect(fake.files.find((f) => f.id === older.id)?.name).toBe(
            "{.chart} Chart — OWID writing reference"
        )
        expect(fake.docText(older.id)).toContain("ArchieML tag: {.chart}")
        expect(fake.docText(newer.id)).toBe("")
        expect(fake.files.find((f) => f.id === newer.id)?.trashed).toBe(false)
    })

    test("a 429 then a 503 on the same call are retried with growing backoff and the run completes", async () => {
        const fake = new FakeGoogle()
        fake.failBatchUpdate(2, googleError(429, "Rate Limit Exceeded"))
        fake.failBatchUpdate(3, googleError(503, "Service Unavailable"))
        const log: string[] = []
        const result = await publish(fake, fixtureRegistries, log)
        expect(result.written).toHaveLength(PLANNED.length)
        expect(fake.sleeps).toEqual([RETRY_DELAYS_MS[0], RETRY_DELAYS_MS[1]])
        expect(log.filter((m) => m.includes("retrying"))).toEqual([
            "Google returned 429; retrying in 2s (1/3)",
            "Google returned 503; retrying in 4s (2/3)",
        ])
    })

    test("a 429 that persists fails after three retries, naming the chunk", async () => {
        const fake = new FakeGoogle()
        for (const call of [1, 2, 3, 4])
            fake.failBatchUpdate(call, googleError(429, "Rate Limit Exceeded"))
        await expect(publish(fake)).rejects.toThrow(
            /batchUpdate failed \(OWID writing reference — start here pass 1, chunk 1\/1, \d+ requests\): Rate Limit Exceeded/
        )
        expect(fake.sleeps).toEqual(RETRY_DELAYS_MS)
        expect(fake.batchUpdateCalls).toBe(4)
    })

    test("a 429 on files.create is retried too", async () => {
        const fake = new FakeGoogle()
        fake.failCreate(1, googleError(429, "Rate Limit Exceeded"))
        await publish(fake)
        expect(fake.sleeps).toEqual([RETRY_DELAYS_MS[0]])
        expect(fake.files).toHaveLength(PLANNED.length)
    })

    test("any other batchUpdate error stops the run with the document, chunk and Google's message, no retry", async () => {
        const fake = new FakeGoogle()
        // 1: index pass 1 (an empty doc needs no clear)
        fake.failBatchUpdate(
            1,
            googleError(400, "Invalid requests[3].updateTextStyle")
        )
        await expect(publish(fake)).rejects.toThrow(
            /batchUpdate failed \(OWID writing reference — start here pass 1, chunk 1\/1, \d+ requests\): Invalid requests\[3\]\.updateTextStyle/
        )
        expect(fake.batchUpdateCalls).toBe(1)
        expect(fake.sleeps).toEqual([])
    })
})
