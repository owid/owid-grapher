import * as express from 'express'
require('express-async-errors')
const cookieParser = require('cookie-parser')
const errorToSlack = require('express-error-slack')
import "reflect-metadata"

import AdminSPA from './AdminSPA'
import {authMiddleware} from './authentication'
import api from './api'
import devServer from './devServer'
import testPages from './testPages'
import adminViews from './adminViews'
import {renderToHtmlPage} from './serverUtil'
import {BUILD_GRAPHER_URL, SLACK_ERRORS_WEBHOOK_URL} from '../settings'

import * as React from 'react'

const app = express()

// Parse cookies https://github.com/expressjs/cookie-parser
app.use(cookieParser())

app.use(express.urlencoded({ extended: true }))

// Require authentication for all requests by default
app.use(authMiddleware)

//app.use(express.urlencoded())

app.use('/admin/api', api.router)
app.use('/admin/test', testPages)
app.use('/grapher', devServer)

app.use('/admin/build', express.static('dist/webpack'))
app.use('/admin', adminViews)

// Default route: single page admin app
app.get('*', (req, res) => {
    res.send(renderToHtmlPage(<AdminSPA rootUrl={`${BUILD_GRAPHER_URL}`} username={res.locals.user.fullName}/>))
})

// Send errors to Slack
// The middleware passes all errors onto the next error-handling middleware
if (SLACK_ERRORS_WEBHOOK_URL) {
    app.use(errorToSlack({ webhookUri: SLACK_ERRORS_WEBHOOK_URL }))
}

// Give full error messages, including in production
app.use(async (err: any, req: any, res: express.Response, next: any) => {
    if (!res.headersSent) {
        res.status(err.status||500)
        res.send({ error: { message: err.stack, status: err.status||500 } })
    } else {
        res.write(JSON.stringify({ error: { message: err.stack, status: err.status||500 } }))
        res.end()
    }
})

export default app