import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"
import { SLACK_BOT_OAUTH_TOKEN } from "../../settings/serverSettings"
import { JsonError } from "@ourworldindata/types"

const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage"

/**
 * Posts to Slack. Separate from the route handler so callers inside the server
 * can use it without inventing a request; `channel` takes a channel id or a user
 * id, and a user id delivers a direct message.
 */
export async function postToSlack(message: {
    channel: string
    blocks?: unknown
    text?: string
    username?: string
}): Promise<void> {
    const response = await fetch(SLACK_POST_MESSAGE_URL, {
        method: "POST",
        body: JSON.stringify(message),
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SLACK_BOT_OAUTH_TOKEN}`,
        },
    })

    if (!response.ok) {
        throw new JsonError(
            `Slack API error: ${response.status} ${response.statusText}`
        )
    }
    // Slack reports its own failures in a 200 body, so a bad channel or a
    // revoked token looks like success unless the payload is read.
    const body = (await response.json().catch(() => undefined)) as
        | { ok?: boolean; error?: string }
        | undefined
    if (body && body.ok === false) {
        throw new JsonError(`Slack API error: ${body.error ?? "unknown"}`)
    }
}

export async function sendMessageToSlack(
    req: Request,
    _res: HandlerResponse,
    _trx: db.KnexReadWriteTransaction
) {
    const { channel, blocks, username } = req.body

    if (!channel) throw new JsonError("Channel missing")
    if (!blocks) throw new JsonError("Blocks missing")

    await postToSlack({ channel, blocks, username })

    return { success: true }
}
