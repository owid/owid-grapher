import { describe, expect, it } from "vitest"
import {
    LatestNewsletter,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import {
    deriveAnnouncementLatestType,
    weaveNewslettersIntoFeed,
} from "./latestUtils.js"

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

describe(weaveNewslettersIntoFeed, () => {
    const record = (date: string) =>
        ({ date }) as unknown as PageChronologicalRecord
    const newsletter = (date: string) => ({ date }) as LatestNewsletter

    const dates = (items: ReturnType<typeof weaveNewslettersIntoFeed>) =>
        items.map((item) =>
            item.kind === "newsletter"
                ? `n:${item.newsletter.date}`
                : `r:${item.record.date}`
        )

    it("interleaves newsletters into records by date descending", () => {
        const items = weaveNewslettersIntoFeed(
            [record("2026-07-20"), record("2026-07-10"), record("2026-07-01")],
            [newsletter("2026-07-17"), newsletter("2026-07-03")],
            false
        )
        expect(dates(items)).toEqual([
            "r:2026-07-20",
            "n:2026-07-17",
            "r:2026-07-10",
            "n:2026-07-03",
            "r:2026-07-01",
        ])
    })

    it("holds back newsletters older than the loaded range while more pages remain", () => {
        const items = weaveNewslettersIntoFeed(
            [record("2026-07-20"), record("2026-07-10")],
            [newsletter("2026-07-17"), newsletter("2026-07-03")],
            true
        )
        expect(dates(items)).toEqual([
            "r:2026-07-20",
            "n:2026-07-17",
            "r:2026-07-10",
        ])
    })

    it("appends remaining newsletters once the last page is loaded", () => {
        const items = weaveNewslettersIntoFeed(
            [record("2026-07-20")],
            [newsletter("2026-07-17"), newsletter("2026-07-03")],
            false
        )
        expect(dates(items)).toEqual([
            "r:2026-07-20",
            "n:2026-07-17",
            "n:2026-07-03",
        ])
    })

    it("returns records unchanged when there are no newsletters", () => {
        const items = weaveNewslettersIntoFeed([record("2026-07-20")], [], true)
        expect(dates(items)).toEqual(["r:2026-07-20"])
    })

    it("returns all newsletters when there are no records", () => {
        const items = weaveNewslettersIntoFeed(
            [],
            [newsletter("2026-07-17")],
            false
        )
        expect(dates(items)).toEqual(["n:2026-07-17"])
    })
})
