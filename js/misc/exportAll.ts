import * as mysql from 'mysql'

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'dev_grapher'
})

conn.connect()

const rootUrl = "http://l:8080/grapher"

conn.query("SELECT slug FROM charts", (err, results) => {
    if (err) throw err

    let i = results.map((r: any) => r.slug).indexOf("colonial-origin")
    function next() {
        const row = results[i]
        try {
            exportChart(`${rootUrl}/${row.slug}`, `export/${row.slug}.svg`, next)
        } catch (e) {
            console.error(e)
            next()
        }
        i += 1
    }

    next()
})

require('isomorphic-fetch')

declare var global: any
global.Global = { rootUrl: rootUrl }
global.window = { location: { search: "" }}
global.App = { isEditor: false }

require('module-alias').addAliases({
    'react'  : 'preact-compat',
    'react-dom': 'preact-compat'
})

import * as fs from 'fs'
//import * as sharp from 'sharp'
import ChartConfig from '../charts/ChartConfig'
import {when} from 'mobx'

function exportChart(targetSrc: string, outputPath: string, callback: () => void) {
    const [configUrl, queryStr] = targetSrc.split(/\?/)
    fetch(configUrl + ".config.json").then(data => data.json()).then(jsonConfig => {
        const chart = new ChartConfig(jsonConfig, { queryStr: queryStr })
        chart.baseFontSize = 18
        console.log(`Rendering ${chart.props.slug}...`)
        when(() => chart.data.isReady, () => {
            setTimeout(() => {
                fs.writeFileSync(outputPath, chart.staticSVG)
                callback()
                //sharp(svgPath, { density: 144 }).png().resize(1020, 720).flatten().background('#ffffff').toFile(outputPath)
            }, 0)
        })
    })
}
