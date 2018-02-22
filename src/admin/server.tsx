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
    const rootUrl = `${req.protocol}://${req.get('host')}`
    res.send(renderToHtmlPage(<AdminSPA rootUrl={rootUrl} username={res.locals.user.name}/>))
})

const HOST = 'localhost'
const PORT = 3030
app.listen(PORT, HOST, () => {
    console.log(`Express started on ${HOST}:${PORT}`)
})
