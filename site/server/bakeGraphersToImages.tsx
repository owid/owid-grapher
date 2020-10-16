import * as lodash from "lodash"
import parseUrl from "url-parse"
import * as db from "db/db"
import { getVariableData } from "db/model/Variable"
import * as fs from "fs-extra"
import { optimizeSvg } from "./svgPngExport"
import md5 from "md5"

declare var global: any
global.window = { location: { search: "" } }

import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"

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

export async function bakeGrapherToImage(
    jsonConfig: GrapherInterface,
    outDir: string,
    slug: string,
    queryStr: string = "",
    optimizeSvgs: boolean = false,
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
    grapher.isExporting = true
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

export async function bakeGraphersToImages(
    grapherUrls: string[],
    outDir: string,
    optimizeSvgs = false
) {
    await fs.mkdirp(outDir)
    const graphersBySlug = await getGraphersAndRedirectsBySlug()

    for (const urlStr of grapherUrls) {
        const url = parseUrl(urlStr)
        const slug = lodash.last(url.pathname.split("/")) as string
        const jsonConfig = graphersBySlug.get(slug)
        if (jsonConfig) {
            bakeGrapherToImage(
                jsonConfig,
                outDir,
                slug,
                (url.query as unknown) as string,
                optimizeSvgs
            )
        }
    }
}
