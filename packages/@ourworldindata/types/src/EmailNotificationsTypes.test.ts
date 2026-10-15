import { describe, expect, it } from "vitest"
import {
    type EmailNotificationsPreferences,
    mergeEmailNotificationsPreferences,
} from "./EmailNotificationsTypes.js"

describe(mergeEmailNotificationsPreferences, () => {
    const existing: EmailNotificationsPreferences = {
        topicTags: ["Energy"],
        contentTypes: ["article"],
        frequency: "weekly",
    }

    it("unions topic tags and content types without duplicates", () => {
        const merged = mergeEmailNotificationsPreferences(existing, {
            topicTags: ["Energy", "Climate Change"],
            contentTypes: ["article", "data-insight"],
            frequency: "weekly",
        })
        expect(merged).toEqual({
            topicTags: ["Energy", "Climate Change"],
            contentTypes: ["article", "data-insight"],
            frequency: "weekly",
        })
    })

    it("keeps existing topic tags when the incoming set is smaller", () => {
        const merged = mergeEmailNotificationsPreferences(existing, {
            topicTags: ["Climate Change"],
            contentTypes: ["announcement"],
            frequency: "weekly",
        })
        expect(merged.topicTags).toEqual(["Energy", "Climate Change"])
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
                topicTags: ["Climate Change"],
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
