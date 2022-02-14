// Send error to slack webhook, code adapted from express-error-slack https://github.com/chunkai1312/express-error-slack/blob/master/src/sendErrorToSlack.js
import {
    SLACK_CONTENT_ERRORS_WEBHOOK_URL,
    SLACK_ERRORS_WEBHOOK_URL,
} from "../settings/serverSettings.js"
import Slack from "slack-node"
import * as lodash from "lodash-es"

const sendErrorToSlack = async (err: any, slackWebhook: string | undefined) => {
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

    const blocks = [{ title: "Stack", code: err.stack }]

    if (err.stderr) {
        blocks.push({
            title: "stderr",
            code: err.stderr,
        })
    }

    const attachment = {
        fallback: `${err.name}: ${err.message}`,
        color: err.status < 500 ? "warning" : "danger",
        //   author_name: req.headers.host,
        title: `${err.name}: ${err.message}`,
        //   fields: [
        //     { title: 'Request URL', value: req.url, short: true },
        //     { title: 'Request Method', value: req.method, short: true },
        //     { title: 'Status Code', value: err.status, short: true },
        //     { title: 'Remote Address', value: getRemoteAddress(req), short: true }
        //   ],
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
