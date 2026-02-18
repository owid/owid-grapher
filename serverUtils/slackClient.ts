import { WebClient, type Block, type KnownBlock } from "@slack/web-api"
import { SLACK_BOT_OAUTH_TOKEN } from "../settings/serverSettings.js"
import { logErrorAndMaybeCaptureInSentry } from "./errorLog.js"

export async function postToSlack(
    channelId: string,
    blocks: (Block | KnownBlock)[],
    text: string
): Promise<void> {
    if (!SLACK_BOT_OAUTH_TOKEN || !channelId) {
        console.warn(
            "Slack notification skipped: missing SLACK_BOT_OAUTH_TOKEN or channel ID"
        )
        return
    }

    try {
        const client = new WebClient(SLACK_BOT_OAUTH_TOKEN)
        await client.chat.postMessage({
            channel: channelId,
            blocks,
            text,
        })
    } catch (error) {
        await logErrorAndMaybeCaptureInSentry(error)
    }
}
