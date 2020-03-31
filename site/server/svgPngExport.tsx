import * as fs from "fs-extra"
import * as sharp from "sharp"
import * as path from "path"
import * as svgo from "svgo"

declare var global: any
global.window = { location: { search: "" } }
global.App = { isEditor: false }

import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

const svgoConfig: svgo.Options = {
    floatPrecision: 1,
    plugins: [{ collapseGroups: false }, { removeViewBox: false }]
}

const SVGO = new svgo(svgoConfig)

async function optimizeSvg(svgString: string): Promise<string> {
    const optimizedSvg = await SVGO.optimize(svgString)
    return optimizedSvg.data
}

export async function chartToSVG(
    jsonConfig: ChartConfigProps,
    vardata: any
): Promise<string> {
    const chart = new ChartConfig(jsonConfig)
    chart.isLocalExport = true
    chart.vardata.receiveData(vardata)
    return chart.staticSVG
}

export async function bakeImageExports(
    outDir: string,
    jsonConfig: ChartConfigProps,
    vardata: any
) {
    const chart = new ChartConfig(jsonConfig)
    chart.isLocalExport = true
    chart.vardata.receiveData(vardata)
    const outPath = path.join(outDir, chart.props.slug as string)

    const optimizedSvg = await optimizeSvg(chart.staticSVG)

    return Promise.all([
        fs
            .writeFile(`${outPath}.svg`, optimizedSvg)
            .then(_ => console.log(`${outPath}.svg`)),
        sharp(Buffer.from(chart.staticSVG), { density: 144 })
            .png()
            .resize(chart.idealBounds.width, chart.idealBounds.height)
            .flatten({ background: "#ffffff" })
            .toFile(`${outPath}.png`)
    ])
}
