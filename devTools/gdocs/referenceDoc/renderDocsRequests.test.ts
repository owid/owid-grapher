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
import { buildReferenceDocument } from "./buildModel.js"
import { renderMarkdown } from "./renderMarkdown.js"
import { fixtureRegistries } from "./testFixtures.js"
import type { Block } from "./model.js"
import {
    MAX_BYTES_PER_CHUNK,
    MAX_REQUESTS_PER_CHUNK,
    MONOSPACE_FONT,
    blocksToRequests,
    chunkRequests,
    emptyTableSpan,
    fillTableRequests,
    locateTables,
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

describe("with the full registries", () => {
    const doc = buildReferenceDocument(
        {
            components: (componentsRegistry as ComponentRegistry).components,
            templates: templatesRegistry as TemplateReference[],
            guides: guidesRegistry as GuideReference[],
        },
        { generatedAt: new Date("2026-10-07T00:00:00Z"), commitSha: "abc1234" }
    )

    test("no chunk exceeds the limits, and the request counts are deterministic", () => {
        const counts = (): number[] =>
            doc.sections.map(
                (section) =>
                    blocksToRequests(section.blocks, TAB).requests.length
            )
        expect(counts()).toEqual(counts())
        for (const section of doc.sections) {
            const chunks = chunkRequests(
                blocksToRequests(section.blocks, TAB).requests
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
        const outsideFences = renderMarkdown(doc)
            .split(/^```$/m)
            .filter((_, index) => index % 2 === 0)
            .join("\n")
        expect(outsideFences).not.toMatch(/`|\*\*|<!--/)
    })

    test("the request counts per section on the fixtures", () => {
        const fixtureDoc = buildReferenceDocument(fixtureRegistries, {
            generatedAt: new Date("2026-10-07T00:00:00Z"),
            commitSha: "abc1234",
        })
        expect(
            fixtureDoc.sections.map((section) => [
                section.title,
                blocksToRequests(section.blocks, TAB).requests.length,
                blocksToRequests(section.blocks, TAB).tables.length,
            ])
        ).toMatchInlineSnapshot(`
          [
            [
              "Overview",
              22,
              0,
            ],
            [
              "Guides",
              61,
              0,
            ],
            [
              "Templates",
              64,
              1,
            ],
            [
              "Components",
              123,
              2,
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
