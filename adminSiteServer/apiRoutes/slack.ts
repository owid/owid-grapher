import * as db from "../../db/db.js"
import { HonoContext } from "../authentication.js"
import { SLACK_BOT_OAUTH_TOKEN } from "../../settings/serverSettings"
import { JsonError } from "@ourworldindata/types"

export async function sendMessageToSlack(
    c: HonoContext,
    _trx: db.KnexReadWriteTransaction
) {
    const url = "https://slack.com/api/chat.postMessage"

    const body = await c.req.json()
    const { channel, blocks, username } = body

    if (!channel) throw new JsonError("Channel missing")
    if (!blocks) throw new JsonError("Blocks missing")

    const data = { channel, blocks, username }

    const fetchData = {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SLACK_BOT_OAUTH_TOKEN}`,
        },
    }

    const response = await fetch(url, fetchData)

    if (!response.ok) {
        throw new JsonError(
            `Slack API error: ${response.status} ${response.statusText}`
        )
    }

    return { success: true }
}
