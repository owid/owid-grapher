import * as parseArgs from 'minimist'
import * as fs from 'fs'
import * as sharp from 'sharp'
const argv = parseArgs(process.argv.slice(2))

const baseUrl: string = argv.baseUrl
const targetSrc: string = argv.targetSrc
const outputPath: string = argv.output

require('isomorphic-fetch')

declare var global: any
global.Global = { rootUrl: baseUrl }
global.window = { location: { search: "" }}
global.App = { isEditor: false }

require('module-alias').addAliases({
    'react'  : 'preact-compat',
    'react-dom': 'preact-compat'
})

import ChartConfig from './charts/ChartConfig'
import {when} from 'mobx'

const [configUrl, queryStr] = targetSrc.split(/\?/)
fetch(configUrl + ".config.json").then(data => data.json()).then(jsonConfig => {
    const chart = new ChartConfig(jsonConfig, { queryStr: queryStr })
    chart.baseFontSize = 18
    when(() => chart.data.isReady, () => {
        setTimeout(() => {
            const svgPath = outputPath.replace('.png', '.svg')
            fs.writeFileSync(svgPath, chart.staticSVG)
            sharp(svgPath, { density: 144 }).png().resize(1020, 720).flatten().background('#ffffff').toFile(outputPath)
        }, 100)
    })
})
