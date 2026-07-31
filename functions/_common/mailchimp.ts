import { Env } from "./env.js"

/**
 * Helpers for the OWID Brief newsletter, which stays in Mailchimp: the
 * subscribe form and the magic-link preferences page manage the Brief
 * interest (group) on the Mailchimp list member. All helpers degrade
 * gracefully when the MAILCHIMP_* environment variables are not set, so the
 * rest of the email notifications flows can be tested locally without
 * Mailchimp credentials.
 */

function hasMailchimpCredentials(env: Env): boolean {
    return Boolean(
        env.MAILCHIMP_API_KEY &&
        env.MAILCHIMP_API_SERVER &&
        env.MAILCHIMP_NEWSLETTER_LIST_ID
    )
}

/** Mailchimp identifies list members by the MD5 hash of the lowercase email. */
async function makeSubscriberHash(email: string): Promise<string> {
    const subscriberDigest = await crypto.subtle.digest(
        // MD5 is not part of the WebCrypto standard but is supported in
        // Cloudflare Workers for interacting with legacy systems that require
        // MD5.
        // https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
        { name: "MD5" },
        new TextEncoder().encode(email.toLowerCase())
    )
    return [...new Uint8Array(subscriberDigest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}

function makeMemberUrl(env: Env, subscriberHash: string): string {
    return `https://${env.MAILCHIMP_API_SERVER}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_NEWSLETTER_LIST_ID}/members/${subscriberHash}`
}

function makeAuthHeader(env: Env): string {
    return `Basic ${btoa(`anystring:${env.MAILCHIMP_API_KEY}`)}`
}

/**
 * Set the OWID Brief interest on the Mailchimp list member, creating the
 * member if needed. New list members are created with
 * `status_if_new: "pending"`, so Mailchimp sends them its own double-opt-in
 * confirmation email. Throws on Mailchimp errors; skips (with a console
 * warning) when Mailchimp credentials are not configured.
 */
export async function upsertOwidBriefSubscription(
    env: Env,
    email: string,
    enabled: boolean
): Promise<void> {
    if (!hasMailchimpCredentials(env)) {
        console.warn(
            "Mailchimp environment variables are not set, skipping OWID Brief update"
        )
        return
    }

    const member: Record<string, unknown> = {
        email_address: email,
        status_if_new: "pending",
    }
    if (env.MAILCHIMP_OWID_BRIEF_INTEREST_ID) {
        member.interests = { [env.MAILCHIMP_OWID_BRIEF_INTEREST_ID]: enabled }
    }

    const response = await fetch(
        makeMemberUrl(env, await makeSubscriberHash(email)),
        {
            method: "PUT",
            headers: {
                Authorization: makeAuthHeader(env),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(member),
        }
    )
    if (!response.ok) {
        const data = await response.json()
        console.error("Failed to update the OWID Brief subscription", data)
        throw new Error(
            `Failed to update the OWID Brief subscription (${response.status})`
        )
    }
}

/**
 * Whether the email is subscribed to the OWID Brief in Mailchimp. Returns
 * null when the status can't be determined (no credentials, Mailchimp error)
 * — callers must fail soft, e.g. by hiding the Brief toggle.
 */
export async function getOwidBriefStatus(
    env: Env,
    email: string
): Promise<boolean | null> {
    if (!hasMailchimpCredentials(env) || !env.MAILCHIMP_OWID_BRIEF_INTEREST_ID)
        return null

    const response = await fetch(
        `${makeMemberUrl(env, await makeSubscriberHash(email))}?fields=status,interests`,
        { headers: { Authorization: makeAuthHeader(env) } }
    )
    // Not a list member at all: not subscribed to the Brief.
    if (response.status === 404) return false
    if (!response.ok) {
        console.error(
            `Failed to fetch the OWID Brief status (${response.status})`
        )
        return null
    }
    const member = (await response.json()) as {
        status?: string
        interests?: Record<string, boolean>
    }
    return (
        member.status === "subscribed" &&
        member.interests?.[env.MAILCHIMP_OWID_BRIEF_INTEREST_ID] === true
    )
}
