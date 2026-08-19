import { describe, expect, it } from "vitest"
import { deriveAnnouncementLatestType } from "./latestUtils.js"

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
