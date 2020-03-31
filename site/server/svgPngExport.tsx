import * as fs from "fs-extra"
import * as sharp from "sharp"
import * as path from "path"

declare var global: any
global.window = { location: { search: "" } }
global.App = { isEditor: false }

import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

export async function chartToSVG(
    jsonConfig: ChartConfigProps,
    vardata: any
): Promise<string> {
    const chart = new ChartConfig(jsonConfig)
    chart.isLocalExport = true
    chart.receiveData(vardata)
    return chart.staticSVG
}

export async function bakeImageExports(
    outDir: string,
    jsonConfig: ChartConfigProps,
    vardata: any
) {
    const chart = new ChartConfig(jsonConfig)
    chart.isLocalExport = true
    chart.receiveData(vardata)
    const outPath = path.join(outDir, chart.props.slug as string)

    return Promise.all([
        fs
            .writeFile(`${outPath}.svg`, chart.staticSVG)
            .then(_ => console.log(`${outPath}.svg`)),
        sharp(Buffer.from(chart.staticSVG), { density: 144 })
            .png()
            .resize(chart.idealBounds.width, chart.idealBounds.height)
            .flatten({ background: "#ffffff" })
            .toFile(`${outPath}.png`)
    ])
}
