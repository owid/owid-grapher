import { describe, expect, it } from "vitest"
import { BlockSize, OwidEnrichedGdocBlock, Span } from "@ourworldindata/types"
import { deriveAnnouncementLatestType, findCtaUrl } from "./latestUtils.js"

describe(deriveAnnouncementLatestType, () => {
    it.each(["data-update", "website-upgrade", "announcement"])(
        "passes through canonical slug %s",
        (kicker) => {
            expect(deriveAnnouncementLatestType(kicker)).toBe(kicker)
        }
    )

    it.each([
        ["Data Update", "data-update"],
        ["Data update", "data-update"],
        ["Website Upgrade", "website-upgrade"],
        ["Announcement", "announcement"],
    ])("normalizes case/spacing variant %s -> %s", (input, expected) => {
        expect(deriveAnnouncementLatestType(input)).toBe(expected)
    })

    it.each([undefined, "", "Random Tag", "Article - 10 Mins"])(
        'falls back to "announcement" for kicker %s',
        (kicker) => {
            expect(deriveAnnouncementLatestType(kicker)).toBe("announcement")
        }
    )
})

describe(findCtaUrl, () => {
    const text = (...value: Span[]): OwidEnrichedGdocBlock => ({
        type: "text",
        value,
        parseErrors: [],
    })
    const plain = (t: string): Span => ({
        spanType: "span-simple-text",
        text: t,
    })
    const link = (url: string, t: string): Span => ({
        spanType: "span-link",
        url,
        children: [plain(t)],
    })
    const cta = (url: string, t: string): OwidEnrichedGdocBlock => ({
        type: "cta",
        url,
        text: t,
        parseErrors: [],
    })
    const image = (filename: string): OwidEnrichedGdocBlock => ({
        type: "image",
        filename,
        size: BlockSize.Wide,
        hasOutline: false,
        parseErrors: [],
    })

    it("finds the cta in the shape every published data update has", () => {
        const body = [
            text(plain("intro")),
            text(link("/some-link", "some link")),
            cta("/grapher/military-spending", "Explore the updated data"),
            image("chart.png"),
        ]
        expect(findCtaUrl(body)).toBe("/grapher/military-spending")
    })
})
