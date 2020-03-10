// Send error to slack webhook, code adapted from express-error-slack https://github.com/chunkai1312/express-error-slack/blob/master/src/sendErrorToSlack.js
import { SLACK_ERRORS_WEBHOOK_URL } from "serverSettings"
import Slack = require("slack-node")
import _ = require("lodash")

export namespace log {
    export async function sendErrorToSlack(err: any) {
        const slack = new Slack()
        slack.setWebhook(SLACK_ERRORS_WEBHOOK_URL)

        function createCodeBlock(title: string, code: any) {
            if (_.isEmpty(code)) return ""
            code =
                typeof code === "string"
                    ? code.trim()
                    : JSON.stringify(code, null, 2)
            const tripleBackticks = "```"
            return `_${title}_${tripleBackticks}${code}${tripleBackticks}\n`
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
            text: [{ title: "Stack", code: err.stack }]
                .map(data => createCodeBlock(data.title, data.code))
                .join(""),
            mrkdwn_in: ["text"],
            footer: "sendErrorToSlack",
            ts: Math.floor(Date.now() / 1000)
        }

        slack.webhook({ attachments: [attachment] }, (error, response) => {
            if (error) console.error(error)
        })
    }

    export async function error(err: any) {
        if (SLACK_ERRORS_WEBHOOK_URL) sendErrorToSlack(err)
        console.error(err)
    }

    export async function warn(err: any) {
        console.warn(err)
    }
}
