import { OwidBriefOptInResult } from "@ourworldindata/types"
import * as _ from "lodash-es"
import { Env } from "./env.js"

/** The OWID Brief remains in Mailchimp rather than D1/Postmark. */

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

async function makeMemberUrl(env: Env, email: string): Promise<string> {
    return `https://${env.MAILCHIMP_API_SERVER}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_NEWSLETTER_LIST_ID}/members/${await makeSubscriberHash(email)}`
}

function makeAuthHeader(env: Env): string {
    return `Basic ${btoa(`anystring:${env.MAILCHIMP_API_KEY}`)}`
}

interface MailchimpMember {
    status?: string
    interests?: Record<string, boolean>
}

/** Returns null when the address is not in the audience. */
async function fetchMember(
    env: Env,
    memberUrl: string
): Promise<MailchimpMember | null> {
    const response = await fetch(`${memberUrl}?fields=status,interests`, {
        headers: { Authorization: makeAuthHeader(env) },
    })
    if (response.status === 404) return null
    if (!response.ok) {
        throw new Error(
            `Failed to fetch the OWID Brief status (${response.status})`
        )
    }
    return (await response.json()) as MailchimpMember
}

/** Returns false if a PATCH races with member deletion. */
async function writeMember(
    env: Env,
    memberUrl: string,
    method: "PUT" | "PATCH",
    body: object
): Promise<boolean> {
    const response = await fetch(memberUrl, {
        method,
        headers: {
            Authorization: makeAuthHeader(env),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
    if (method === "PATCH" && response.status === 404) return false
    if (!response.ok) {
        const data = await response.json()
        console.error("Failed to update the OWID Brief subscription", data)
        throw new Error(
            `Failed to update the OWID Brief subscription (${response.status})`
        )
    }
    return true
}

/** Mailchimp blocks API resubscription of hard-bounced contacts. */
export class MailchimpCleanedContactError extends Error {
    constructor() {
        super(
            "Mailchimp marked this address as undeliverable after earlier emails bounced"
        )
    }
}

/**
 * New and active members use single opt-in. Unsubscribed and pending contacts
 * use `pending` because Mailchimp rejects direct API resubscription; cleaned
 * contacts cannot be resubscribed.
 */
export async function enableOwidBriefSubscription(
    env: Env,
    email: string
): Promise<OwidBriefOptInResult> {
    validateMailchimpConfiguration(env)
    const memberUrl = await makeMemberUrl(env, email)
    const interests = { [env.MAILCHIMP_OWID_BRIEF_INTEREST_ID]: true }

    const member = await fetchMember(env, memberUrl)
    if (member?.status === "cleaned") throw new MailchimpCleanedContactError()
    if (member?.status === "subscribed") {
        if (member.interests?.[env.MAILCHIMP_OWID_BRIEF_INTEREST_ID] === true) {
            return "active"
        }
        if (await writeMember(env, memberUrl, "PATCH", { interests })) {
            return "active"
        }
        // Recreate a member deleted after the fetch.
    } else if (member) {
        // Confirmation enables every selected interest. After a global opt-out,
        // retain only the newly consented Brief; leave pending choices untouched.
        if (member.status === "pending") {
            // Reapplying `pending` does not send another confirmation, and
            // transitioning through `unsubscribed` cannot be made atomic.
            if (await writeMember(env, memberUrl, "PATCH", { interests })) {
                return "pending"
            }
            // Recreate a member deleted after the fetch.
        } else {
            const updated = await writeMember(env, memberUrl, "PATCH", {
                status: "pending",
                interests: {
                    ..._.mapValues(member.interests ?? {}, () => false),
                    ...interests,
                },
            })
            if (updated) return "pending"
        }
    }
    await writeMember(env, memberUrl, "PUT", {
        email_address: email,
        status_if_new: "subscribed",
        interests,
    })
    return "active"
}

/** Missing members count as already unsubscribed. */
export async function disableOwidBriefSubscription(
    env: Env,
    email: string
): Promise<void> {
    validateMailchimpConfiguration(env)
    await writeMember(env, await makeMemberUrl(env, email), "PATCH", {
        interests: { [env.MAILCHIMP_OWID_BRIEF_INTEREST_ID]: false },
    })
}

/** Throws when Mailchimp status cannot be determined. */
export async function getOwidBriefStatus(
    env: Env,
    email: string
): Promise<boolean> {
    validateMailchimpConfiguration(env)
    const member = await fetchMember(env, await makeMemberUrl(env, email))
    // Not a list member at all: not subscribed to the Brief.
    if (!member) return false
    return (
        member.status === "subscribed" &&
        member.interests?.[env.MAILCHIMP_OWID_BRIEF_INTEREST_ID] === true
    )
}
