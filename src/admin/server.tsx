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

app.get('/admin/api/charts.json', api.getChartsJson)
app.post('/admin/api/charts/:chartId/star', api.starChart)
app.get('/admin/api/charts/:chartId.config.json', api.getChartConfig)
app.get('/admin/api/data/variables/:variableStr', api.getVariables)
app.get('/admin/api/editorData/namespaces.json', api.getNamespaces)
app.get('/admin/api/editorData/:namespace.json', api.getNamespaceData)
app.post('/admin/api/charts', api.createChart)
app.put('/admin/api/charts/:chartId', api.updateChart)

//url(r'^grapher/admin/editorData/namespaces\.(?P<cachetag>[^.]*?)\.?json', admin_views.editordata, name="editordata"),
//url(r'^grapher/admin/editorData/(?P<namespace>[^.]*?)\.(?P<cachetag>[^.]*?)\.?json', admin_views.namespacedata, name="namespacedata"),

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
