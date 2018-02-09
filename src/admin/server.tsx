import * as express from 'express'
import { uniq } from 'lodash'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as db from '../db'
import AdminSPA from './AdminSPA'

import {authMiddleware} from './authentication'


const app = express()

authMiddleware(app)

app.use(express.json())
db.connect()


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

    res.send(renderToHtmlPage(<AdminSPA username={res.locals.user.username}/>))
})

app.listen(3000, () => console.log("Express started"))
