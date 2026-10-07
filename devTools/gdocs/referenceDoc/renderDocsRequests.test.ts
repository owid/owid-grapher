/*
 * Model → Docs API requests, without Google: indices from a running cursor,
 * style resets per block, tables planned in pass 1 and filled in pass 2.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/renderDocsRequests.test.ts
 */

import { describe, expect, test } from "vitest"
import type { docs_v1 } from "@googleapis/docs"
import type {
    ComponentRegistry,
    GuideReference,
    TemplateReference,
} from "@ourworldindata/types"
import componentsRegistry from "@ourworldindata/types/src/gdocTypes/components.registry.generated.json"
import templatesRegistry from "@ourworldindata/types/src/gdocTypes/templates.registry.generated.json"
import guidesRegistry from "@ourworldindata/types/src/gdocTypes/guides.registry.generated.json"
import { buildReferenceLibrary } from "./buildModel.js"
import { renderLibraryMarkdownAsOne } from "./renderMarkdown.js"
import { fixtureRegistries } from "./testFixtures.js"
import type { Block, ReferenceDoc } from "./model.js"
import { heading, paragraph, text } from "./model.js"
import {
    MAX_BYTES_PER_CHUNK,
    MAX_REQUESTS_PER_CHUNK,
    MONOSPACE_FONT,
    blocksToRequests,
    bodyPlainText,
    chunkRequests,
    emptyTableSpan,
    fillTableRequests,
    locateTables,
    plainTextOf,
} from "./renderDocsRequests.js"

const TAB = "t.0"

describe(blocksToRequests, () => {
    test("a heading on a cleared tab: insert at the end, reset styles, named heading style over 1..end", () => {
        const { requests, endIndex } = blocksToRequests(
            [{ type: "heading", level: 2, text: "Chart" }],
            TAB
        )
        expect(requests).toEqual([
            {
                insertText: {
                    text: "Chart\n",
                    endOfSegmentLocation: { tabId: TAB },
                },
            },
            {
                updateTextStyle: {
                    range: { startIndex: 1, endIndex: 7, tabId: TAB },
                    textStyle: {},
                    fields: "weightedFontFamily,bold,italic,link,underline,foregroundColor",
                },
            },
            {
                updateParagraphStyle: {
                    range: { startIndex: 1, endIndex: 7, tabId: TAB },
                    paragraphStyle: { namedStyleType: "HEADING_2" },
                    fields: "namedStyleType",
                },
            },
        ])
        expect(endIndex).toBe(7)
    })

    test("runs are styled at absolute offsets after the paragraph's reset", () => {
        const { requests } = blocksToRequests(
            [
                {
                    type: "paragraph",
                    runs: [
                        { text: "Use " },
                        { text: "{.chart}", code: true },
                        { text: " or ", bold: false },
                        { text: "docs", link: "https://x.y" },
                    ],
                },
            ],
            TAB,
            10
        )
        const styles = requests.filter((r) => r.updateTextStyle).slice(1)
        expect(styles).toEqual([
            {
                updateTextStyle: {
                    range: { startIndex: 14, endIndex: 22, tabId: TAB },
                    textStyle: {
                        weightedFontFamily: { fontFamily: MONOSPACE_FONT },
                    },
                    fields: "weightedFontFamily",
                },
            },
            {
                updateTextStyle: {
                    range: { startIndex: 26, endIndex: 30, tabId: TAB },
                    textStyle: expect.objectContaining({
                        link: { url: "https://x.y" },
                    }),
                    fields: "link,underline,foregroundColor",
                },
            },
        ])
    })

    test("bullets: one insert for all items, bullets over the range, and the next block removes the inherited bullet", () => {
        const { requests } = blocksToRequests(
            [
                { type: "bullets", items: [[{ text: "a" }], [{ text: "bb" }]] },
                { type: "paragraph", runs: [{ text: "after" }] },
            ],
            TAB
        )
        expect(requests[0].insertText?.text).toBe("a\nbb\n")
        expect(requests.find((r) => r.createParagraphBullets)).toEqual({
            createParagraphBullets: {
                range: { startIndex: 1, endIndex: 6, tabId: TAB },
                bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
            },
        })
        expect(requests.find((r) => r.deleteParagraphBullets)).toEqual({
            deleteParagraphBullets: {
                range: { startIndex: 6, endIndex: 12, tabId: TAB },
            },
        })
    })

    test("a code block is one monospace run over all its lines", () => {
        const { requests } = blocksToRequests(
            [{ type: "code", text: "{.chart}\nurl: x\n{}" }],
            TAB
        )
        expect(requests.at(-1)).toEqual({
            updateTextStyle: {
                range: { startIndex: 1, endIndex: 20, tabId: TAB },
                textStyle: {
                    weightedFontFamily: { fontFamily: MONOSPACE_FONT },
                },
                fields: "weightedFontFamily",
            },
        })
    })

    test("a table is inserted empty and planned with its header row; the cursor skips its span", () => {
        const table: Block = {
            type: "table",
            header: ["Key", "Type"],
            rows: [[[{ text: "url", code: true }], [{ text: "string" }]]],
        }
        const { requests, tables, endIndex } = blocksToRequests(
            [
                { type: "heading", level: 3, text: "Properties" }, // 1..12
                table,
                { type: "paragraph", runs: [{ text: "after" }] },
            ],
            TAB
        )
        expect(requests.find((r) => r.insertTable)).toEqual({
            insertTable: {
                rows: 2,
                columns: 2,
                endOfSegmentLocation: { tabId: TAB },
            },
        })
        // insertTable adds a newline, so the table starts at 12 + 1
        const span = emptyTableSpan(2, 2)
        expect(tables).toEqual([
            {
                startIndex: 13,
                rows: 2,
                columns: 2,
                cells: [
                    [
                        [{ text: "Key", bold: true }],
                        [{ text: "Type", bold: true }],
                    ],
                    [[{ text: "url", code: true }], [{ text: "string" }]],
                ],
            },
        ])
        const after = requests.findLast((r) => r.insertText)
        expect(
            requests.find(
                (r) =>
                    r.updateParagraphStyle &&
                    r.updateParagraphStyle.range?.startIndex === 13 + span
            )
        ).toBeDefined()
        expect(after?.insertText?.text).toBe("after\n")
        expect(endIndex).toBe(13 + span + 6)
    })
})

describe(fillTableRequests, () => {
    const planned = blocksToRequests(
        [
            {
                type: "table",
                header: ["A"],
                rows: [[[{ text: "x", code: true }]]],
            },
            {
                type: "table",
                header: ["B", "C"],
                rows: [[[{ text: "" }], [{ text: "y" }]]],
            },
        ],
        TAB
    ).tables

    // What documents.get would return for those two empty tables
    const content: docs_v1.Schema$StructuralElement[] = [
        tableElement(planned[0].startIndex, 2, 1),
        tableElement(planned[1].startIndex, 2, 2),
    ]

    test("fills cells from the last table and cell to the first, bold header", () => {
        const requests = fillTableRequests(planned, locateTables(content), TAB)
        const inserts = requests
            .filter((r) => r.insertText)
            .map((r) => [r.insertText!.location!.index, r.insertText!.text])
        const second = locateTables(content)[1].cellIndexes
        const first = locateTables(content)[0].cellIndexes
        expect(inserts).toEqual([
            [second[1][1], "y"],
            [second[0][1], "C"],
            [second[0][0], "B"],
            [first[1][0], "x"],
            [first[0][0], "A"],
        ])
        // Indices strictly decrease, so each one is still valid when it runs
        const indexes = inserts.map(([index]) => index as number)
        expect([...indexes].sort((a, b) => b - a)).toEqual(indexes)
        // "y" has no style; the header cell "C" is bold
        expect(requests[2]).toEqual({
            updateTextStyle: {
                range: {
                    startIndex: second[0][1],
                    endIndex: second[0][1] + 1,
                    tabId: TAB,
                },
                textStyle: { bold: true },
                fields: "bold",
            },
        })
    })

    test("refuses tables that are not where pass 1 planned them", () => {
        const shifted = [
            tableElement(planned[0].startIndex + 1, 2, 1),
            content[1],
        ]
        expect(() =>
            fillTableRequests(planned, locateTables(shifted), TAB)
        ).toThrow(/differs from the plan/)
        expect(() =>
            fillTableRequests(planned, locateTables([content[0]]), TAB)
        ).toThrow(/Planned 2 tables but found 1/)
    })
})

describe(chunkRequests, () => {
    const request = (n: number): docs_v1.Schema$Request => ({
        insertText: { text: "x".repeat(n) },
    })

    test("splits by request count and by JSON size, keeping order", () => {
        const requests = Array.from({ length: 5 }, (_, i) => request(i + 1))
        expect(chunkRequests(requests, 2, 10_000).map((c) => c.length)).toEqual(
            [2, 2, 1]
        )
        const byBytes = chunkRequests(requests, 100, 70)
        expect(byBytes.length).toBeGreaterThan(1)
        expect(byBytes.flat()).toEqual(requests)
    })
})

describe(plainTextOf, () => {
    const sample: Block[] = [
        heading(1, "Chart"),
        paragraph(text("Intro "), { text: "{.chart}", code: true }),
        { type: "bullets", items: [[text("one")], [text("two")]] },
        {
            type: "table",
            header: ["Key", "Type"],
            rows: [[[{ text: "url", code: true }], []]],
        },
        { type: "code", text: "{.chart}\nurl: x\n{}" },
    ]

    test("is the text pass 1 inserts, with each table's cells where pass 2 puts them", () => {
        const { requests, tables } = blocksToRequests(sample, TAB)
        // Replay the inserts in order; a table contributes its newline and
        // then its cells, one paragraph each, as pass 2 will fill them
        let replayed = ""
        let tableIndex = 0
        for (const request of requests) {
            if (request.insertText?.endOfSegmentLocation)
                replayed += request.insertText.text
            if (request.insertTable) {
                const cells = tables[tableIndex++].cells.flat()
                replayed +=
                    "\n" +
                    cells
                        .map((runs) => runs.map((r) => r.text).join("") + "\n")
                        .join("")
            }
        }
        expect(plainTextOf(sample)).toBe(replayed)
        expect(plainTextOf(sample)).toBe(
            "Chart\nIntro {.chart}\none\ntwo\n\n\nKey\nType\nurl\n\n{.chart}\nurl: x\n{}\n"
        )
    })

    test("bodyPlainText reads the same text back from a fetched body, final newline dropped", () => {
        const content: docs_v1.Schema$StructuralElement[] = [
            {
                paragraph: {
                    elements: [
                        { textRun: { content: "Chart\n" } },
                        { textRun: { content: "Intro " } },
                        { textRun: { content: "{.chart}\n" } },
                    ],
                },
            },
            { paragraph: { elements: [{ textRun: { content: "\n" } }] } },
            {
                table: {
                    tableRows: [
                        {
                            tableCells: [
                                {
                                    content: [
                                        {
                                            paragraph: {
                                                elements: [
                                                    {
                                                        textRun: {
                                                            content: "Key\n",
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                },
                                {
                                    content: [
                                        {
                                            paragraph: {
                                                elements: [
                                                    {
                                                        textRun: {
                                                            content: "\n",
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
            { paragraph: { elements: [{ textRun: { content: "\n" } }] } },
        ]
        expect(bodyPlainText(content)).toBe("Chart\nIntro {.chart}\n\nKey\n\n")
        expect(
            plainTextOf([
                heading(1, "Chart"),
                paragraph(text("Intro {.chart}")),
                { type: "table", header: ["Key", ""], rows: [] },
            ])
        ).toBe("Chart\nIntro {.chart}\n\nKey\n\n")
    })
})

describe("with the full registries", () => {
    const library = buildReferenceLibrary(
        {
            components: (componentsRegistry as ComponentRegistry).components,
            templates: templatesRegistry as TemplateReference[],
            guides: guidesRegistry as GuideReference[],
        },
        {
            generatedAt: new Date("2026-10-07T00:00:00Z"),
            commitSha: "abc1234",
            urlFor: () => undefined,
        }
    )
    const docs: ReferenceDoc[] = [library.index, ...library.items]

    test("no chunk exceeds the limits, and the request counts are deterministic", () => {
        const counts = (): number[] =>
            docs.map((doc) => blocksToRequests(doc.blocks, TAB).requests.length)
        expect(counts()).toEqual(counts())
        for (const doc of docs) {
            const chunks = chunkRequests(
                blocksToRequests(doc.blocks, TAB).requests
            )
            for (const chunk of chunks) {
                expect(chunk.length).toBeLessThanOrEqual(MAX_REQUESTS_PER_CHUNK)
                expect(
                    Buffer.byteLength(JSON.stringify(chunk))
                ).toBeLessThanOrEqual(MAX_BYTES_PER_CHUNK)
            }
        }
    })

    test("no Markdown syntax leaks into the text outside code fences", () => {
        const outsideFences = renderLibraryMarkdownAsOne(library)
            .split(/^```$/m)
            .filter((_, index) => index % 2 === 0)
            .join("\n")
        expect(outsideFences).not.toMatch(/`|\*\*|<!--/)
    })

    test("the request counts per document on the fixtures", () => {
        const fixtureLibrary = buildReferenceLibrary(fixtureRegistries, {
            generatedAt: new Date("2026-10-07T00:00:00Z"),
            commitSha: "abc1234",
            urlFor: () => undefined,
        })
        expect(
            [fixtureLibrary.index, ...fixtureLibrary.items].map((doc) => [
                doc.docTitle,
                blocksToRequests(doc.blocks, TAB).requests.length,
                blocksToRequests(doc.blocks, TAB).tables.length,
            ])
        ).toMatchInlineSnapshot(`
          [
            [
              "OWID writing reference — start here",
              50,
              5,
            ],
            [
              "{.callout} Callout — OWID writing reference",
              28,
              1,
            ],
            [
              "{.text} Text — OWID writing reference",
              20,
              0,
            ],
            [
              "{.chart} Chart — OWID writing reference",
              59,
              1,
            ],
            [
              "{.cookie-notice} Cookie notice — OWID writing reference",
              20,
              0,
            ],
            [
              "Article (template) — OWID writing reference",
              68,
              1,
            ],
            [
              "Refs and footnotes (guide) — OWID writing reference",
              36,
              0,
            ],
            [
              "Publishing a document (guide) — OWID writing reference",
              14,
              0,
            ],
          ]
        `)
    })
})

/** A fetched empty table: table, rows, cells and their empty paragraphs */
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
