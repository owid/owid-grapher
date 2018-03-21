import * as express from 'express'
require('express-async-errors')
import { uniq } from 'lodash'
const cookieParser = require('cookie-parser')
const errorToSlack = require('express-error-slack').default

import * as db from '../db'
import AdminSPA from './AdminSPA'
import LoginPage from './LoginPage'
import {authMiddleware, loginSubmit} from './authentication'
import api from './api'
import {renderToHtmlPage} from './serverUtil'
import {NODE_SERVER_PORT, BUILD_GRAPHER_URL, SLACK_ERRORS_WEBHOOK_URL} from '../settings'

import * as React from 'react'

const app = express()

// Parse cookies https://github.com/expressjs/cookie-parser
app.use(cookieParser())

// Require authentication for all requests
app.use(authMiddleware)

//app.use(express.urlencoded())

db.connect()

/*app.get('/admin/login', (req, res) => {
    res.send(renderToHtmlPage(<LoginPage/>))
})*/

app.use('/admin/api', api.router)

// Default route: single page admin app
app.get('*', (req, res) => {
    res.send(renderToHtmlPage(<AdminSPA rootUrl={`${BUILD_GRAPHER_URL}`} username={res.locals.user.name}/>))
})

// Send errors to slack
if (SLACK_ERRORS_WEBHOOK_URL) {
    app.use(errorToSlack({ webhookUri: SLACK_ERRORS_WEBHOOK_URL }))
}

// Give full error messages in production
app.use(async (err: any, req: any, res: any, next: any) => {
    res.status(err.status||500)
    res.send({ error: { message: err.stack, status: err.status||500 } })
})

const HOST = 'localhost'
app.listen(NODE_SERVER_PORT, HOST, () => {
    console.log(`Express started on ${HOST}:${NODE_SERVER_PORT}`)
})
