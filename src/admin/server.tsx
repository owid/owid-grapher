import * as express from 'express'
require('express-async-errors')
import { uniq } from 'lodash'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
const cookieParser = require('cookie-parser')

import * as db from '../db'
import AdminSPA from './AdminSPA'
import {authMiddleware} from './authentication'
import api from './api'

const app = express()

// Parse cookies https://github.com/expressjs/cookie-parser
app.use(cookieParser())

// Require authentication for all requests
app.use(authMiddleware)

// Parse incoming requests with JSON payloads http://expressjs.com/en/api.html
app.use(express.json())

db.connect()

app.use('/admin/api', api.router)

function renderToHtmlPage(element: any) {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}

// Default route: single page admin app
app.get('*', (req, res) => {
    const baseUrl = "http://l:3030/grapher"
    const cacheTag = "waffles"
    const currentUser = "jaiden"
    const isDebug = true

    const rootUrl = `${req.protocol}://${req.get('host')}`

    res.send(renderToHtmlPage(<AdminSPA rootUrl={rootUrl} username={res.locals.user.name}/>))
})

app.listen(3030, () => console.log("Express started"))
