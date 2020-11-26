import * as lodash from "lodash"
import parseUrl from "url-parse"
import * as db from "db/db"
import { getVariableData } from "db/model/Variable"
import * as fs from "fs-extra"
import svgo from "svgo"
import md5 from "md5"
import sharp from "sharp"
import * as path from "path"

// todo: can we remove the below 2 lines?
declare var global: any
global.window = { location: { search: "" } }

import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"

export async function bakeGraphersToPngs(
    outDir: string,
    jsonConfig: GrapherInterface,
    vardata: any,
    optimizeSvgs = false
) {
    const grapher = new Grapher({ ...jsonConfig, manuallyProvideData: true })
    grapher.isExportingtoSvgOrPng = true
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

async function getGraphersAndRedirectsBySlug() {
    const { graphersBySlug, graphersById } = await getPublishedGraphersBySlug()

    const redirectQuery = db.query(
        `SELECT slug, chart_id FROM chart_slug_redirects`
    )

    for (const row of await redirectQuery) {
        graphersBySlug.set(row.slug, graphersById.get(row.chart_id))
    }

    return graphersBySlug
}

export async function getPublishedGraphersBySlug() {
    const graphersBySlug: Map<string, GrapherInterface> = new Map()
    const graphersById = new Map()

    const query = db.query(
        `SELECT * FROM charts WHERE JSON_EXTRACT(config, "$.isPublished") IS TRUE`
    )
    for (const row of await query) {
        const grapher = JSON.parse(row.config)

        grapher.id = row.id
        graphersBySlug.set(grapher.slug, grapher)
        graphersById.set(row.id, grapher)
    }
    return { graphersBySlug, graphersById }
}

export async function bakeGrapherToSvg(
    jsonConfig: GrapherInterface,
    outDir: string,
    slug: string,
    queryStr = "",
    optimizeSvgs = false,
    overwriteExisting = false,
    verbose = true
) {
    // the type definition for url.query is wrong (bc we have query string parsing disabled),
    // so we have to explicitly cast it
    const grapher = new Grapher({
        ...jsonConfig,
        manuallyProvideData: true,
        queryStr,
    })
    grapher.isExportingtoSvgOrPng = true
    const { width, height } = grapher.idealBounds
    const outPath = `${outDir}/${slug}${queryStr ? "-" + md5(queryStr) : ""}_v${
        jsonConfig.version
    }_${width}x${height}.svg`
    if (verbose) console.log(outPath)

    if (fs.existsSync(outPath) && !overwriteExisting) return

    const variableIds = lodash.uniq(grapher.dimensions.map((d) => d.variableId))
    const vardata = await getVariableData(variableIds)
    grapher.receiveLegacyData(vardata)

    let svgCode = grapher.staticSVG
    if (optimizeSvgs) svgCode = await optimizeSvg(svgCode)

    fs.writeFile(outPath, svgCode)
    return svgCode
}

export async function bakeGraphersToSvgs(
    grapherUrls: string[],
    outDir: string,
    optimizeSvgs = false
) {
    await fs.mkdirp(outDir)
    const graphersBySlug = await getGraphersAndRedirectsBySlug()

    return Promise.all(
        Array.from(grapherUrls).map((urlStr) => {
            const url = parseUrl(urlStr)
            const slug = lodash.last(url.pathname.split("/")) as string
            const jsonConfig = graphersBySlug.get(slug)
            if (jsonConfig) {
                return bakeGrapherToSvg(
                    jsonConfig,
                    outDir,
                    slug,
                    (url.query as unknown) as string,
                    optimizeSvgs
                )
            }
            return undefined
        })
    )
}

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

async function optimizeSvg(svgString: string): Promise<string> {
    const optimizedSvg = await svgoInstance.optimize(svgString)
    return optimizedSvg.data
}

export async function grapherToSVG(
    jsonConfig: GrapherInterface,
    vardata: any
): Promise<string> {
    const grapher = new Grapher({ ...jsonConfig, manuallyProvideData: true })
    grapher.isExportingtoSvgOrPng = true
    grapher.receiveLegacyData(vardata)
    return grapher.staticSVG
}
