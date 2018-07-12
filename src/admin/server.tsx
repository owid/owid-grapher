import * as express from 'express'
require('express-async-errors')
const cookieParser = require('cookie-parser')
const errorToSlack = require('express-error-slack')
import "reflect-metadata"

import * as db from '../db'
import * as wpdb from '../articles/wpdb'
import AdminSPA from './AdminSPA'
import LoginPage from './LoginPage'
import {authMiddleware, loginSubmit, logout} from './authentication'
import api from './api'
import devServer from './devServer'
import testPages from './testPages'
import adminViews from './adminViews'
import {renderToHtmlPage} from './serverUtil'
import {NODE_SERVER_PORT, BUILD_GRAPHER_URL, SLACK_ERRORS_WEBHOOK_URL} from '../settings'

import * as React from 'react'

const app = express()

// Parse cookies https://github.com/expressjs/cookie-parser
app.use(cookieParser())

app.use(express.urlencoded({ extended: true }))

// Require authentication for all requests
app.use(authMiddleware)

//app.use(express.urlencoded())

db.connect()
wpdb.connect()

app.get('/admin/logout', logout)
app.post('/admin/login', loginSubmit)
app.get('/admin/login', (req, res) => {
    res.send(renderToHtmlPage(<LoginPage next={req.query.next}/>))
})

app.use('/admin/api', api.router)
app.use('/admin/test', testPages)
app.use('/grapher', devServer)

app.use('/admin', adminViews)

// Default route: single page admin app
app.get('*', (req, res) => {
    res.send(renderToHtmlPage(<AdminSPA rootUrl={`${BUILD_GRAPHER_URL}`} username={res.locals.user.name}/>))
})

// Send errors to slack
if (SLACK_ERRORS_WEBHOOK_URL) {
    app.use(errorToSlack({ webhookUri: SLACK_ERRORS_WEBHOOK_URL }))
}

// Give full error messages in production
app.use(async (err: any, req: any, res: express.Response, next: any) => {
    if (!res.headersSent) {
        res.status(err.status||500)
        res.send({ error: { message: err.stack, status: err.status||500 } })
    } else {
        res.write(JSON.stringify({ error: { message: err.stack, status: err.status||500 } }))
        res.end()
    }
})

app.listen(NODE_SERVER_PORT, "localhost", () => {
    console.log(`Express started on localhost:${NODE_SERVER_PORT}`)
})
