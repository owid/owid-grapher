/*
 * The Google side, against an in-memory stand-in for the Docs API: tabs are
 * found by title and created or renamed as needed, re-runs refill in place,
 * stray tabs survive, --single-tab writes one tab, and a failing batchUpdate
 * stops the run naming the chunk.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/publish.test.ts
 */

import { describe, expect, test } from "vitest"
import type { docs_v1 } from "@googleapis/docs"
import type { ReferenceDocument } from "./model.js"
import { heading, paragraph, text } from "./model.js"
import { flattenToSingleTab } from "./buildModel.js"
import { emptyTableSpan } from "./renderDocsRequests.js"
import { publishReferenceDoc } from "./publish.js"

const DOC_ID = "doc-1"

const referenceDoc: ReferenceDocument = {
    sections: [
        {
            title: "Overview",
            blocks: [heading(1, "Hello"), paragraph(text("Intro."))],
        },
        { title: "Guides", blocks: [heading(1, "Refs")] },
        {
            title: "Templates",
            blocks: [
                heading(1, "Article"),
                {
                    type: "table",
                    header: ["Key", "Type"],
                    rows: [
                        [[{ text: "title", code: true }], [{ text: "string" }]],
                    ],
                },
            ],
        },
        { title: "Components", blocks: [heading(1, "Chart")] },
    ],
}

/** One tab of the fake document: a body of paragraphs and empty tables */
interface FakeTab {
    tabId: string
    title: string
    content: docs_v1.Schema$StructuralElement[]
}

/**
 * Just enough of the Docs API for the publisher: documents.get with tabs,
 * and the batchUpdate requests it sends. Indices follow the API's documented
 * layout — text advances by its length, insertTable adds a newline then an
 * empty table with one empty paragraph per cell.
 */
class FakeDocs {
    readonly tabs: FakeTab[]
    batchUpdateCalls = 0
    /** addDocumentTab + updateDocumentTabProperties requests seen */
    tabSetupRequests = 0
    private nextTabNumber = 1
    private failOnCall?: number

    constructor(tabs: { title: string; text?: string }[]) {
        this.tabs = tabs.map((tab, index) => ({
            tabId: `t.${index}`,
            title: tab.title,
            content: paragraphElements(tab.text ?? ""),
        }))
        this.nextTabNumber = tabs.length
    }

    failOnBatchUpdate(callNumber: number): void {
        this.failOnCall = callNumber
    }

    tabEndIndex(tab: FakeTab): number {
        return tab.content.at(-1)?.endIndex ?? 2
    }

    /** The tab body as text, tables as [table], without the body's final newline */
    tabText(title: string): string {
        return this.tabs
            .find((tab) => tab.title === title)!
            .content.map(elementText)
            .join("")
            .slice(0, -1)
    }

    asClient(): docs_v1.Docs {
        const documents = {
            get: async (): Promise<{ data: docs_v1.Schema$Document }> => ({
                data: {
                    documentId: DOC_ID,
                    tabs: this.tabs.map((tab, index) => ({
                        tabProperties: {
                            tabId: tab.tabId,
                            title: tab.title,
                            index,
                        },
                        documentTab: { body: { content: tab.content } },
                    })),
                },
            }),
            batchUpdate: async (params: {
                requestBody?: docs_v1.Schema$BatchUpdateDocumentRequest
            }): Promise<{
                data: docs_v1.Schema$BatchUpdateDocumentResponse
            }> => {
                this.batchUpdateCalls++
                if (this.batchUpdateCalls === this.failOnCall)
                    throw new Error("Invalid requests[3].updateTextStyle")
                const replies = (params.requestBody?.requests ?? []).map(
                    (request) => this.apply(request)
                )
                return { data: { replies } }
            },
        }
        return { documents } as unknown as docs_v1.Docs
    }

    private apply(request: docs_v1.Schema$Request): docs_v1.Schema$Response {
        if (request.updateDocumentTabProperties) {
            this.tabSetupRequests++
            const props = request.updateDocumentTabProperties.tabProperties!
            this.tab(props.tabId!).title = props.title!
            return {}
        }
        if (request.addDocumentTab) {
            this.tabSetupRequests++
            const props = request.addDocumentTab.tabProperties!
            const tab: FakeTab = {
                tabId: `t.${this.nextTabNumber++}`,
                title: props.title!,
                content: paragraphElements(""),
            }
            this.tabs.splice(props.index ?? this.tabs.length, 0, tab)
            return { addDocumentTab: { tabProperties: { tabId: tab.tabId } } }
        }
        if (request.deleteContentRange) {
            const range = request.deleteContentRange.range!
            const tab = this.tab(range.tabId!)
            expect(range.startIndex).toBe(1)
            expect(range.endIndex).toBe(this.tabEndIndex(tab) - 1)
            tab.content = paragraphElements("")
            return {}
        }
        if (request.insertText) {
            const { text, endOfSegmentLocation, location } = request.insertText
            if (endOfSegmentLocation) {
                const tab = this.tab(endOfSegmentLocation.tabId!)
                appendText(tab, text!)
            } else {
                // Pass 2: cell text. Only check the cell exists at that index.
                const tab = this.tab(location!.tabId!)
                expect(cellIndexes(tab)).toContain(location!.index)
            }
            return {}
        }
        if (request.insertTable) {
            const { rows, columns, endOfSegmentLocation } = request.insertTable
            const tab = this.tab(endOfSegmentLocation!.tabId!)
            // The paragraph before the table keeps its newline (the one the
            // API inserts before a table); a fresh trailing paragraph follows
            const start = this.tabEndIndex(tab)
            const span = emptyTableSpan(rows!, columns!)
            tab.content.push(tableElement(start, rows!, columns!))
            tab.content.push({
                startIndex: start + span,
                endIndex: start + span + 1,
                paragraph: { elements: [{ textRun: { content: "\n" } }] },
            })
            return {}
        }
        // Style requests: range must lie inside the tab
        const range =
            request.updateTextStyle?.range ??
            request.updateParagraphStyle?.range ??
            request.createParagraphBullets?.range ??
            request.deleteParagraphBullets?.range
        if (range) {
            const tab = this.tab(range.tabId!)
            expect(range.endIndex).toBeLessThanOrEqual(this.tabEndIndex(tab))
        }
        return {}
    }

    private tab(tabId: string): FakeTab {
        const tab = this.tabs.find((candidate) => candidate.tabId === tabId)
        if (!tab) throw new Error(`No tab ${tabId}`)
        return tab
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

function appendText(tab: FakeTab, text: string): void {
    const last = tab.content.at(-1)!
    const run = last.paragraph!.elements![0].textRun!
    // Insert before the trailing newline
    run.content = run.content!.slice(0, -1) + text + "\n"
    last.endIndex = last.endIndex! + text.length
}

function elementText(element: docs_v1.Schema$StructuralElement): string {
    if (element.paragraph)
        return element.paragraph
            .elements!.map((e) => e.textRun!.content)
            .join("")
    return "[table]"
}

function cellIndexes(tab: FakeTab): number[] {
    return tab.content.flatMap((element) =>
        (element.table?.tableRows ?? []).flatMap((row) =>
            (row.tableCells ?? []).map((cell) => cell.content![0].startIndex!)
        )
    )
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
                    { startIndex: index, endIndex: index + 1, paragraph: {} },
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
    fake: FakeDocs,
    doc = referenceDoc,
    singleTab = false
): Promise<string[]> {
    const result = await publishReferenceDoc(doc, {
        documentId: DOC_ID,
        singleTab,
        client: fake.asClient(),
    })
    return result.tabIds
}

describe(publishReferenceDoc, () => {
    test("fresh doc: the first tab becomes Overview, the other sections are added after it", async () => {
        const fake = new FakeDocs([{ title: "Tab 1" }])
        const tabIds = await publish(fake)
        expect(fake.tabs.map((tab) => tab.title)).toEqual([
            "Overview",
            "Guides",
            "Templates",
            "Components",
        ])
        expect(fake.tabs[0].tabId).toBe("t.0")
        expect(tabIds).toEqual(fake.tabs.map((tab) => tab.tabId))
        expect(fake.tabText("Overview")).toBe("Hello\nIntro.\n")
        // The API puts a newline paragraph before a table
        expect(fake.tabText("Templates")).toBe("Article\n\n[table]")
    })

    test("re-run: tabs are cleared and refilled in place, ids and order unchanged", async () => {
        const fake = new FakeDocs([{ title: "Tab 1" }])
        const first = await publish(fake)
        expect(fake.tabSetupRequests).toBe(4)
        const second = await publish(fake)
        expect(second).toEqual(first)
        expect(fake.tabs.map((tab) => tab.tabId)).toEqual(first)
        expect(fake.tabText("Overview")).toBe("Hello\nIntro.\n")
        expect(fake.tabText("Guides")).toBe("Refs\n")
        // No tab was renamed or added on the second run
        expect(fake.tabSetupRequests).toBe(4)
    })

    test("a stray tab with another title is left untouched", async () => {
        const fake = new FakeDocs([
            { title: "Tab 1" },
            { title: "Notes", text: "Keep me" },
        ])
        await publish(fake)
        expect(fake.tabs.map((tab) => tab.title)).toEqual([
            "Overview",
            "Guides",
            "Templates",
            "Components",
            "Notes",
        ])
        expect(fake.tabText("Notes")).toBe("Keep me")
        expect(fake.tabs.at(-1)?.tabId).toBe("t.1")
    })

    test("a first tab titled like a later section is claimed as Overview; that section gets a new tab", async () => {
        const fake = new FakeDocs([{ title: "Guides", text: "old" }])
        const tabIds = await publish(fake)
        expect(fake.tabs.map((tab) => tab.title)).toEqual([
            "Overview",
            "Guides",
            "Templates",
            "Components",
        ])
        expect(new Set(tabIds).size).toBe(4)
        expect(tabIds).toEqual(fake.tabs.map((tab) => tab.tabId))
        expect(fake.tabText("Guides")).toBe("Refs\n")
    })

    test("--single-tab refuses a document that was not flattened to one section", async () => {
        const fake = new FakeDocs([{ title: "Everything" }])
        await expect(publish(fake, referenceDoc, true)).rejects.toThrow(
            /flattened to one section/
        )
        expect(fake.batchUpdateCalls).toBe(0)
    })

    test("--single-tab: only the first tab is written, whatever its title", async () => {
        const fake = new FakeDocs([
            { title: "Everything", text: "old" },
            { title: "Notes", text: "Keep me" },
        ])
        const tabIds = await publish(
            fake,
            flattenToSingleTab(referenceDoc),
            true
        )
        expect(tabIds).toEqual(["t.0"])
        expect(fake.tabs.map((tab) => tab.title)).toEqual([
            "Everything",
            "Notes",
        ])
        expect(fake.tabText("Everything")).toBe(
            "Overview\nHello\nIntro.\nGuides\nRefs\nTemplates\nArticle\n\n[table]Components\nChart\n"
        )
        expect(fake.tabText("Notes")).toBe("Keep me")
    })

    test("a rejected batchUpdate stops the run with the chunk and Google's message, no retry", async () => {
        const fake = new FakeDocs([{ title: "Tab 1", text: "old" }])
        // 1: tab setup, 2: clear, 3: Overview pass 1
        fake.failOnBatchUpdate(3)
        await expect(publish(fake)).rejects.toThrow(
            /batchUpdate failed \(Overview pass 1, chunk 1\/1, \d+ requests\): Invalid requests\[3\]\.updateTextStyle/
        )
        expect(fake.batchUpdateCalls).toBe(3)
    })
})
