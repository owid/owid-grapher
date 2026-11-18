import { describe, expect, it } from "vitest"
import type { EmailNotificationsPreferences } from "@ourworldindata/types"
import { chooseSubscribeEmail } from "./subscribeEmail.js"

// Each address gets the full welcome email once.
// Every later notifications submission gets a short confirmation email
// (so the owner can notice a submission they didn't make).
// A later Brief-only submission gets no email from us. Mailchimp sends its own
// confirmation email for a pending Brief opt-in (we can't control this).

const preferences: EmailNotificationsPreferences = {
    topicTags: ["Energy and Environment"],
    contentTypes: ["article"],
    frequency: "weekly",
}

describe(chooseSubscribeEmail, () => {
    describe("notifications signup", () => {
        it("sends the full welcome if it hasn't been sent yet", () => {
            expect(
                chooseSubscribeEmail({
                    preferences,
                    isWelcomeEmailSent: false,
                    isBriefActive: false,
                })
            ).toEqual({ template: "welcome", preferences })
        })

        it("mentions the Brief only when its opt-in is active", () => {
            expect(
                chooseSubscribeEmail({
                    preferences,
                    isWelcomeEmailSent: false,
                    isBriefActive: true,
                })
            ).toEqual({ template: "welcomeWithBrief", preferences })
        })

        it("sends a short confirmation if the full welcome was already sent", () => {
            expect(
                chooseSubscribeEmail({
                    preferences,
                    isWelcomeEmailSent: true,
                    isBriefActive: true,
                })
            ).toEqual({ template: "subscriptionUpdated", preferences })
        })
    })

    describe("Brief-only signup", () => {
        it("sends the full welcome if it hasn't been sent yet", () => {
            expect(
                chooseSubscribeEmail({
                    preferences: null,
                    isWelcomeEmailSent: false,
                    isBriefActive: true,
                })
            ).toEqual({ template: "welcomeBriefOnly" })
        })

        it("sends nothing to someone who already got the full welcome", () => {
            expect(
                chooseSubscribeEmail({
                    preferences: null,
                    isWelcomeEmailSent: true,
                    isBriefActive: true,
                })
            ).toBeNull()
        })

        it("sends nothing while the Brief opt-in isn't active", () => {
            // Pending: Mailchimp's confirmation email covers it. Or cleaned:
            // Mailchimp rejected the address.
            expect(
                chooseSubscribeEmail({
                    preferences: null,
                    isWelcomeEmailSent: false,
                    isBriefActive: false,
                })
            ).toBeNull()
        })
    })
})
