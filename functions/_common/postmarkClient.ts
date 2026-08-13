import { Models, ServerClient } from "postmark"
import { Env } from "./env.js"

export const POSTMARK_BROADCAST_MESSAGE_STREAM = "broadcast"
export const POSTMARK_REACTIVATION_USER_MESSAGE =
    "We couldn't reactivate email notifications for this address. Please contact us for help."

export class PostmarkRecipientReactivationError extends Error {}

let postmarkClient: ServerClient | undefined

export function getPostmarkClient(env: Env): ServerClient {
    if (!env.POSTMARK_SERVER_TOKEN) {
        throw new Error("POSTMARK_SERVER_TOKEN is not configured")
    }
    if (postmarkClient) return postmarkClient
    // POSTMARK_API_BASE_URL may point at the local Postmark catcher (yarn
    // postmarkCatcher), which the SDK expects split into scheme and host.
    const { protocol, host } = new URL(
        env.POSTMARK_API_BASE_URL || "https://api.postmarkapp.com"
    )
    postmarkClient = new ServerClient(
        env.POSTMARK_SERVER_TOKEN,
        new Models.ClientOptions.Configuration(protocol === "https:", host)
    )
    return postmarkClient
}

/**
 * Remove Postmark's broadcast-stream suppression after an explicit
 * resubscription. Postmark reports per-address failures in a successful HTTP
 * response, so check the item status rather than relying on the SDK to throw.
 */
export async function reactivatePostmarkRecipient(
    env: Env,
    email: string
): Promise<void> {
    try {
        const client = getPostmarkClient(env)
        const response = await client.deleteSuppressions(
            POSTMARK_BROADCAST_MESSAGE_STREAM,
            { Suppressions: [{ EmailAddress: email }] }
        )
        const result = response.Suppressions[0]
        if (result.Status !== "Deleted") {
            throw new Error(
                `Postmark suppression deletion returned status=${result.Status} for ${email}: ${result.Message}`
            )
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new PostmarkRecipientReactivationError(
            `Postmark recipient reactivation failed for ${email}: ${message}`,
            { cause: error }
        )
    }
}
