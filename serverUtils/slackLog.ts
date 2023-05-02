// Send error to slack webhook, code adapted from express-error-slack https://github.com/chunkai1312/express-error-slack/blob/master/src/sendErrorToSlack.js
import {
    SLACK_CONTENT_ERRORS_WEBHOOK_URL,
    SLACK_ERRORS_WEBHOOK_URL,
} from "../settings/serverSettings.js"
import Slack from "slack-node"
import * as lodash from "lodash"
import { stringifyUnknownError } from "@ourworldindata/utils"

const sendErrorToSlack = async (
    err: unknown,
    slackWebhook: string | undefined
) => {
    if (!slackWebhook) return

    const slack = new Slack()
    slack.setWebhook(slackWebhook)

    function createCodeBlock(title: string, code: any) {
        if (lodash.isEmpty(code)) return ""
        code =
            typeof code === "string"
                ? code.trim()
                : JSON.stringify(code, null, 2)
        const tripleBackticks = "```"
        return `_${title}_${tripleBackticks}${code}${tripleBackticks}\n`
    }

    const errorMessage = stringifyUnknownError(err)
    const blocks = []

    // Node doesn't include stack traces for fs errors :(
    // So, if we don't have a stack trace, create one that's slightly inaccurate (because it's created here rather than
    // where the error was thrown), but that's still better than no trace at all!
    let stack = err instanceof Error ? err.stack : undefined
    if (!stack || !stack.includes("\n"))
        stack = Error("dummy_error_for_stacktrace").stack

    blocks.push({ title: "Stack", code: stack })

    if (err instanceof Error && "stderr" in err) {
        blocks.push({
            title: "stderr",
            code: err.stderr,
        })
    }

    const attachment = {
        title: errorMessage,
        fallback: errorMessage,
        color: "danger",
        text: blocks
            .map((data) => createCodeBlock(data.title, data.code))
            .join(""),
        mrkdwn_in: ["text"],
        footer: "sendErrorToSlack",
        ts: Math.floor(Date.now() / 1000),
    }

    slack.webhook({ attachments: [attachment] }, (error) => {
        if (error) console.error(error)
    })
}

export const logContentErrorAndMaybeSendToSlack = async (err: any) => {
    return logErrorAndMaybeSendToSlack(err, SLACK_CONTENT_ERRORS_WEBHOOK_URL)
}

export const logErrorAndMaybeSendToSlack = async (
    err: any,
    slackWebhook?: string
) => {
    console.error(err)
    sendErrorToSlack(err, slackWebhook ?? SLACK_ERRORS_WEBHOOK_URL)
}

export const warn = (err: any) => console.warn(err)
