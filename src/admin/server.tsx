import * as express from 'express'
require('express-async-errors')
import { uniq } from 'lodash'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
const cookieParser = require('cookie-parser')

import * as db from '../db'
import AdminSPA from './AdminSPA'
import {authMiddleware} from './authentication'
import * as api from './api'

const app = express()

// Parse cookies https://github.com/expressjs/cookie-parser
app.use(cookieParser())

// Require authentication for all requests
app.use(authMiddleware)

// Parse incoming requests with JSON payloads http://expressjs.com/en/api.html
app.use(express.json())

db.connect()


async function hi() {
    throw new Error("oh dear")
}

app.get('/admin/api/charts.json', api.chartsJson)
app.get('/admin/api/test', async (req, res) => {
    res.send(await hi())
})

function renderToHtmlPage(element: any) {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}

// Default route: single page admin app
app.get('*', (req, res) => {
    console.log(res.locals.user)
    const baseUrl = "http://l:3000/grapher"
    const cacheTag = "waffles"
    const currentUser = "jaiden"
    const isDebug = true

    const rootUrl = `${req.protocol}://${req.get('host')}`

    res.send(renderToHtmlPage(<AdminSPA rootUrl={rootUrl} username={res.locals.user.username}/>))
})

app.listen(3000, () => console.log("Express started"))
