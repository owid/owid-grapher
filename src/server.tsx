import * as express from 'express'
import { uniq } from 'lodash'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import * as async from 'async'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as db from './db'

const cookieParser = require('cookie-parser')

const app = express()
app.use(cookieParser())
app.use(express.json())
db.connect()

// Default route: single page admin app
app.get('*', (req, res) => {
    console.log(req.cookies)
    const baseUrl = "http://l:3000/grapher"
    const cacheTag = "waffles"
    const currentUser = "jaiden"
    const isDebug = true

    res.send("testtt")
})


app.listen(3000, () => console.log("Express started"))
