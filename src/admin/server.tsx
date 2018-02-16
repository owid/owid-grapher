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

class FunctionalWrapper {
    app: express.Express
    constructor(expressApp: express.Express) {
        this.app = expressApp
    }

    wrap(callback: (req: express.Request, res: express.Response) => Promise<any>) {
        return async (req: express.Request, res: express.Response) => {
            res.send(await callback(req, res))
        }
    }

    get(path: string, callback: (req: express.Request, res: express.Response) => Promise<any>) {
        this.app.get(path, this.wrap(callback))
    }

    post(path: string, callback: (req: express.Request, res: express.Response) => Promise<any>) {
        this.app.post(path, this.wrap(callback))
    }

    put(path: string, callback: (req: express.Request, res: express.Response) => Promise<any>) {
        this.app.put(path, this.wrap(callback))
    }

    delete(path: string, callback: (req: express.Request, res: express.Response) => Promise<any>) {
        this.app.delete(path, this.wrap(callback))
    }
}

const urls = new FunctionalWrapper(app)

urls.get('/admin/api/charts.json', api.chartsIndex)
urls.post('/admin/api/charts/:chartId/star', api.chartsStar)
urls.get('/admin/api/charts/:chartId.config.json', api.chartsConfig)
urls.get('/admin/api/data/variables/:variableStr', api.variablesGet)
urls.get('/admin/api/editorData/namespaces.json', api.editorNamespaces)
urls.get('/admin/api/editorData/:namespace.json', api.editorDataForNamespace)
urls.post('/admin/api/charts', api.chartsCreate)
urls.put('/admin/api/charts/:chartId', api.chartsUpdate)
urls.delete('/admin/api/charts/:chartId', api.chartsDelete)
urls.get('/admin/api/users/:userId.json', api.usersGet)
urls.get('/admin/api/users.json', api.usersIndex)
urls.delete('/admin/api/users/:userId', api.usersDelete)
urls.put('/admin/api/users/:userId', api.usersUpdate)

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
