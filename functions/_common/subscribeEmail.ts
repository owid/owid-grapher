import type { EmailNotificationsPreferences } from "@ourworldindata/types"

/**
 * The email a subscribe-form submission sends, named after its pre-rendered
 * template. The `welcome*` templates are the full welcome email, sent once per
 * address; `subscriptionUpdated` is a short confirmation of the merged
 * preferences.
 */
export type SubscribeEmail =
    | {
          template: "welcome" | "welcomeWithBrief" | "subscriptionUpdated"
          preferences: EmailNotificationsPreferences
      }
    | { template: "welcomeBriefOnly" }

/**
 * Decide which email a subscribe-form submission sends, if any.
 *
 * Each address gets a welcome email once: ours, unless Mailchimp already sent
 * its own (to any Mailchimp subscriber, including a migrated one). Ours
 * mentions the Brief only when the Brief opt-in is active, so it never
 * promises a newsletter that still needs Mailchimp's confirmation.
 *
 * A notifications signup always sends one email, so the owner of an address
 * submitted by someone else can notice and undo it: the full welcome until it
 * has been sent, the short confirmation after that. A Brief-only signup
 * sends only the full welcome, and only when the opt-in is active: a pending
 * one is covered by Mailchimp's confirmation email.
 */
export function chooseSubscribeEmail({
    preferences,
    isWelcomeEmailSent,
    isBriefActive,
}: {
    /** The merged notification preferences; null for a Brief-only signup. */
    preferences: EmailNotificationsPreferences | null
    /** Whether we (via Postmark) or Mailchimp sent the welcome email. */
    isWelcomeEmailSent: boolean
    isBriefActive: boolean
}): SubscribeEmail | null {
    if (preferences) {
        if (isWelcomeEmailSent)
            return { template: "subscriptionUpdated", preferences }
        return {
            template: isBriefActive ? "welcomeWithBrief" : "welcome",
            preferences,
        }
    }
    if (isBriefActive && !isWelcomeEmailSent)
        return { template: "welcomeBriefOnly" }
    return null
}
