import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"
import * as fs from "fs-extra"
import * as path from "path"
import * as sharp from "sharp"

declare var global: any
global.window = { location: { search: "" } }
global.App = { isEditor: false }


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
