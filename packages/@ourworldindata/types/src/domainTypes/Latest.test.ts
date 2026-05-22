import { describe, expect, it } from "vitest"
import { OwidGdocType } from "../gdocTypes/Gdoc.js"
import { PageChronologicalRecordSchema } from "./Latest.js"

const baseRecord = {
    objectID: "gdoc-1",
    slug: "test-page",
    title: "Test page",
    excerpt: "A short excerpt",
    date: "2026-05-18T00:00:00.000Z",
    modifiedDate: "2026-05-18T00:00:00.000Z",
    authors: ["Example Author"],
    tags: ["Health"],
    thumbnailUrl: "https://example.com/thumbnail.png",
}

describe("chronological page record schema", () => {
    it("accepts valid chronological record variants", () => {
        const records = [
            {
                ...baseRecord,
                type: OwidGdocType.DataInsight,
                latestType: "data-insight",
                body: [{ type: "text" }],
            },
            {
                ...baseRecord,
                type: OwidGdocType.Article,
                latestType: "article",
                featuredImage: "featured.png",
                latestFeedExcerpt: [{ type: "text" }],
            },
            {
                ...baseRecord,
                type: OwidGdocType.Announcement,
                latestType: "announcement",
                body: [],
                cta: { text: "Read more", url: "/test-page" },
            },
            {
                ...baseRecord,
                type: OwidGdocType.TopicPage,
            },
            {
                ...baseRecord,
                type: OwidGdocType.LinearTopicPage,
            },
        ]

        for (const record of records) {
            expect(
                PageChronologicalRecordSchema.safeParse(record).success
            ).toBe(true)
        }
    })

    it("rejects fields that belong to a different variant", () => {
        const parsed = PageChronologicalRecordSchema.safeParse({
            ...baseRecord,
            type: OwidGdocType.DataInsight,
            latestType: "data-insight",
            body: [],
            featuredImage: "article-only.png",
            cta: { text: "Announcement only", url: "/test-page" },
        })

        expect(parsed.success).toBe(false)
    })

    it("rejects topic records with latestType present", () => {
        const parsed = PageChronologicalRecordSchema.safeParse({
            ...baseRecord,
            type: OwidGdocType.TopicPage,
            latestType: undefined,
        })

        expect(parsed.success).toBe(false)
    })

    it("rejects arbitrary extra fields", () => {
        const parsed = PageChronologicalRecordSchema.safeParse({
            ...baseRecord,
            type: OwidGdocType.Article,
            latestType: "article",
            unexpectedField: true,
        })

        expect(parsed.success).toBe(false)
    })
})
