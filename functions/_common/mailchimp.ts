import { Env } from "./env.js"

/**
 * API helpers for the OWID Brief newsletter, which stays in Mailchimp.
 * Opt-ins for active audience members update the Brief interest directly.
 * Contacts in a compliance state still go through Mailchimp's hosted signup
 * form so they can resubscribe.
 */

function validateMailchimpConfiguration(env: Env): void {
    const missingVariables: string[] = []
    if (!env.MAILCHIMP_API_KEY) missingVariables.push("MAILCHIMP_API_KEY")
    if (!env.MAILCHIMP_API_SERVER) missingVariables.push("MAILCHIMP_API_SERVER")
    if (!env.MAILCHIMP_NEWSLETTER_LIST_ID)
        missingVariables.push("MAILCHIMP_NEWSLETTER_LIST_ID")
    if (!env.MAILCHIMP_OWID_BRIEF_INTEREST_ID)
        missingVariables.push("MAILCHIMP_OWID_BRIEF_INTEREST_ID")
    if (missingVariables.length > 0) {
        throw new Error(
            `Mailchimp configuration is missing: ${missingVariables.join(", ")}`
        )
    }
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
 * Disable the OWID Brief interest on an existing Mailchimp list member. An
 * address that has never joined the audience is already not subscribed, so a
 * missing member is an idempotent success.
 */
export async function disableOwidBriefSubscription(
    env: Env,
    email: string
): Promise<void> {
    validateMailchimpConfiguration(env)

    const response = await fetch(
        makeMemberUrl(env, await makeSubscriberHash(email)),
        {
            method: "PATCH",
            headers: {
                Authorization: makeAuthHeader(env),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                interests: {
                    [env.MAILCHIMP_OWID_BRIEF_INTEREST_ID]: false,
                },
            }),
        }
    )
    if (response.status === 404) return
    if (!response.ok) {
        const data = await response.json()
        console.error("Failed to update the OWID Brief subscription", data)
        throw new Error(
            `Failed to update the OWID Brief subscription (${response.status})`
        )
    }
}

/**
 * Enable the OWID Brief interest when the address is an active Mailchimp
 * audience member. Returns false when the hosted signup form is required to
 * add or globally resubscribe the address.
 */
export async function enableOwidBriefSubscriptionForAudienceMember(
    env: Env,
    email: string
): Promise<boolean> {
    validateMailchimpConfiguration(env)

    const memberUrl = makeMemberUrl(env, await makeSubscriberHash(email))
    const memberResponse = await fetch(`${memberUrl}?fields=status,interests`, {
        headers: { Authorization: makeAuthHeader(env) },
    })
    if (memberResponse.status === 404) return false
    if (!memberResponse.ok) {
        console.error(
            `Failed to fetch the OWID Brief status (${memberResponse.status})`
        )
        throw new Error(
            `Failed to fetch the OWID Brief status (${memberResponse.status})`
        )
    }

    const member = (await memberResponse.json()) as {
        status?: string
        interests?: Record<string, boolean>
    }
    if (member.status !== "subscribed") return false
    if (member.interests?.[env.MAILCHIMP_OWID_BRIEF_INTEREST_ID] === true) {
        return true
    }

    const updateResponse = await fetch(memberUrl, {
        method: "PATCH",
        headers: {
            Authorization: makeAuthHeader(env),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            interests: {
                [env.MAILCHIMP_OWID_BRIEF_INTEREST_ID]: true,
            },
        }),
    })
    // The member may have disappeared between the read and update.
    if (updateResponse.status === 404) return false
    if (!updateResponse.ok) {
        const data = await updateResponse.json()
        console.error("Failed to update the OWID Brief subscription", data)
        throw new Error(
            `Failed to update the OWID Brief subscription (${updateResponse.status})`
        )
    }
    return true
}

/**
 * Whether the email is subscribed to the OWID Brief in Mailchimp. Throws on
 * missing configuration and returns null when a Mailchimp error
 * prevents the status from being determined. Callers must fail soft, e.g. by
 * hiding the Brief toggle.
 */
export async function getOwidBriefStatus(
    env: Env,
    email: string
): Promise<boolean | null> {
    validateMailchimpConfiguration(env)

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
