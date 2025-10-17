import { describe, expect, it } from "vitest"
import type { docs_v1 } from "@googleapis/docs"
import { acceptAllGdocSuggestions } from "./acceptAllGdocSuggestions.js"

const createTestDocument = (): docs_v1.Schema$Document => ({
    documentId: "test",
    body: {
        content: [
            {
                startIndex: 1,
                endIndex: 10,
                paragraph: {
                    elements: [
                        {
                            startIndex: 1,
                            endIndex: 4,
                            textRun: {
                                content: "One",
                                textStyle: { bold: true },
                            },
                        },
                        {
                            startIndex: 4,
                            endIndex: 10,
                            textRun: {
                                content: " remove",
                                suggestedDeletionIds: ["delete-1"],
                            },
                        },
                        {
                            startIndex: 10,
                            endIndex: 16,
                            textRun: {
                                content: " insert",
                                suggestedInsertionIds: ["insert-1"],
                            },
                        },
                    ],
                },
            },
            {
                startIndex: 20,
                endIndex: 30,
                paragraph: {
                    elements: [
                        {
                            startIndex: 20,
                            endIndex: 30,
                            textRun: {
                                content: "Style",
                                textStyle: { bold: true },
                                suggestedTextStyleChanges: {
                                    "suggest-style": {
                                        textStyle: {
                                            italic: true,
                                        },
                                        textStyleSuggestionState: {
                                            boldSuggested: true,
                                            italicSuggested: true,
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        ],
    },
})

describe(acceptAllGdocSuggestions.name, () => {
    it("removes deletions, keeps insertions, and applies style changes", () => {
        const original = createTestDocument()
        const transformed = acceptAllGdocSuggestions(original)

        expect(transformed).not.toBe(original)

        const firstParagraphElements =
            transformed.body?.content?.[0]?.paragraph?.elements ?? []

        expect(firstParagraphElements).toHaveLength(2)
        const [kept, inserted] = firstParagraphElements
        expect(kept?.textRun?.content).toBe("One")
        expect(inserted?.textRun?.content).toBe(" insert")
        expect(inserted?.textRun?.suggestedInsertionIds).toBeUndefined()

        const styledRun =
            transformed.body?.content?.[1]?.paragraph?.elements?.[0]?.textRun
        expect(styledRun?.textStyle?.bold).toBeUndefined()
        expect(styledRun?.textStyle?.italic).toBe(true)
        expect(styledRun?.suggestedTextStyleChanges).toBeUndefined()
    })
})
