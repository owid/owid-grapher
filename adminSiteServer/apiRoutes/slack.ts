import e from "express"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import { SLACK_BOT_OAUTH_TOKEN } from "../../settings/serverSettings"
import { JsonError } from "@ourworldindata/types"

export async function sendMessageToSlack(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadWriteTransaction
) {
    const url = "https://slack.com/api/chat.postMessage"

    const { channel, blocks, username } = req.body

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
