import * as express from "express"
import * as React from "react"
import "reflect-metadata"
import { SLACK_ERRORS_WEBHOOK_URL } from "serverSettings"
import { renderToHtmlPage } from "utils/server/serverUtil"

import { AdminSPA } from "./AdminSPA"
import { adminViews } from "./adminViews"
import { api, publicApi } from "./api"
import { authMiddleware } from "./authentication"
import { testPages } from "./testPages"
require("express-async-errors")
const cookieParser = require("cookie-parser")
const expressErrorSlack = require("express-error-slack")

const app = express()

// Parse cookies https://github.com/expressjs/cookie-parser
app.use(cookieParser())

app.use(express.urlencoded({ extended: true }))

// Require authentication (only for /admin requests)
app.use(authMiddleware)

//app.use(express.urlencoded())

app.use("/api", publicApi.router)

app.use("/admin/api", api.router)
app.use("/admin/test", testPages)

app.use("/admin/build", express.static("dist/webpack"))
app.use("/admin", adminViews)

// Default route: single page admin app
app.get("/admin/*", (req, res) => {
    res.send(
        renderToHtmlPage(
            <AdminSPA
                username={res.locals.user.fullName}
                isSuperuser={res.locals.user.isSuperuser}
            />
        )
    )
})

// Send errors to Slack
// The middleware passes all errors onto the next error-handling middleware
if (SLACK_ERRORS_WEBHOOK_URL) {
    app.use(expressErrorSlack({ webhookUri: SLACK_ERRORS_WEBHOOK_URL }))
}

// Give full error messages, including in production
app.use(async (err: any, req: any, res: express.Response, next: any) => {
    if (!res.headersSent) {
        res.status(err.status || 500)
        res.send({
            error: { message: err.stack || err, status: err.status || 500 }
        })
    } else {
        res.write(
            JSON.stringify({
                error: { message: err.stack || err, status: err.status || 500 }
            })
        )
        res.end()
    }
})

export { app }
