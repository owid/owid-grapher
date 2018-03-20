import * as express from 'express'
require('express-async-errors')
import { uniq } from 'lodash'
const cookieParser = require('cookie-parser')

import * as db from '../db'
import AdminSPA from './AdminSPA'
import LoginPage from './LoginPage'
import {authMiddleware, loginSubmit} from './authentication'
import api from './api'
import {renderToHtmlPage} from './serverUtil'
import {NODE_SERVER_PORT, BUILD_GRAPHER_URL} from '../settings'

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

const HOST = 'localhost'
app.listen(NODE_SERVER_PORT, HOST, () => {
    console.log(`Express started on ${HOST}:${NODE_SERVER_PORT}`)
})
