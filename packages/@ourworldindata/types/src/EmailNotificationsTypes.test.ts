import { describe, expect, it } from "vitest"
import {
    type EmailNotificationsPreferences,
    mergeEmailNotificationsPreferences,
} from "./EmailNotificationsTypes.js"

describe(mergeEmailNotificationsPreferences, () => {
    const existing: EmailNotificationsPreferences = {
        topicTags: ["Energy and Environment"],
        contentTypes: ["article"],
        frequency: "weekly",
    }

    it("unions topic tags and content types without duplicates", () => {
        const merged = mergeEmailNotificationsPreferences(existing, {
            topicTags: ["Energy and Environment", "Health"],
            contentTypes: ["article", "data-insight"],
            frequency: "weekly",
        })
        expect(merged).toEqual({
            topicTags: ["Energy and Environment", "Health"],
            contentTypes: ["article", "data-insight"],
            frequency: "weekly",
        })
    })

    it("keeps existing topic tags when the incoming set is smaller", () => {
        const merged = mergeEmailNotificationsPreferences(existing, {
            topicTags: ["Health"],
            contentTypes: ["announcement"],
            frequency: "weekly",
        })
        expect(merged.topicTags).toEqual(["Energy and Environment", "Health"])
        expect(merged.contentTypes).toEqual(["article", "announcement"])
    })

    it("treats empty topic tags as all topics, absorbing the other side", () => {
        const incomingEmpty = mergeEmailNotificationsPreferences(existing, {
            topicTags: [],
            contentTypes: ["article"],
            frequency: "weekly",
        })
        expect(incomingEmpty.topicTags).toEqual([])

        const existingEmpty = mergeEmailNotificationsPreferences(
            { ...existing, topicTags: [] },
            {
                topicTags: ["Health"],
                contentTypes: ["article"],
                frequency: "weekly",
            }
        )
        expect(existingEmpty.topicTags).toEqual([])
    })

    it("takes the incoming frequency", () => {
        expect(
            mergeEmailNotificationsPreferences(existing, {
                ...existing,
                frequency: "daily",
            }).frequency
        ).toBe("daily")
        expect(
            mergeEmailNotificationsPreferences(
                { ...existing, frequency: "daily" },
                existing
            ).frequency
        ).toBe("weekly")
    })
})
