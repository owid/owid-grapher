import * as fs from "fs-extra"
import sharp from "sharp"
import * as path from "path"
import svgo from "svgo"

declare var global: any
global.window = { location: { search: "" } }

import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"

const svgoConfig: svgo.Options = {
    floatPrecision: 2,
    plugins: [
        { collapseGroups: false }, // breaks the "Our World in Data" logo in the upper right
        { removeUnknownsAndDefaults: false }, // would remove hrefs from links (<a>)
        { removeViewBox: false },
        { removeXMLNS: false },
    ],
}

const svgoInstance = new svgo(svgoConfig)

export async function optimizeSvg(svgString: string): Promise<string> {
    const optimizedSvg = await svgoInstance.optimize(svgString)
    return optimizedSvg.data
}

export async function chartToSVG(
    jsonConfig: GrapherInterface,
    vardata: any
): Promise<string> {
    const grapher = new Grapher({ ...jsonConfig, manuallyProvideData: true })
    grapher.isExporting = true
    grapher.receiveLegacyData(vardata)
    return grapher.staticSVG
}

export async function bakeImageExports(
    outDir: string,
    jsonConfig: GrapherInterface,
    vardata: any,
    optimizeSvgs = false
) {
    const grapher = new Grapher({ ...jsonConfig, manuallyProvideData: true })
    grapher.isExporting = true
    grapher.receiveLegacyData(vardata)
    const outPath = path.join(outDir, grapher.slug as string)

    let svgCode = grapher.staticSVG
    if (optimizeSvgs) svgCode = await optimizeSvg(svgCode)

    return Promise.all([
        fs
            .writeFile(`${outPath}.svg`, svgCode)
            .then(() => console.log(`${outPath}.svg`)),
        sharp(Buffer.from(grapher.staticSVG), { density: 144 })
            .png()
            .resize(grapher.idealBounds.width, grapher.idealBounds.height)
            .flatten({ background: "#ffffff" })
            .toFile(`${outPath}.png`),
    ])
}
