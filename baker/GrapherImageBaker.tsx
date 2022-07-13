import * as db from "../db/db.js"
import { getDataForMultipleVariables } from "../db/model/Variable.js"
import * as fs from "fs-extra"
import svgo from "svgo"
import sharp from "sharp"
import * as path from "path"
import { GrapherInterface } from "../grapher/core/GrapherInterface.js"
import { Grapher } from "../grapher/core/Grapher.js"
import {
    grapherSlugToExportFileKey,
    grapherUrlToSlugAndQueryStr,
} from "./GrapherBakingUtils.js"
import { MultipleOwidVariableDataDimensionsMap } from "../clientUtils/OwidVariable.js"

export async function bakeGraphersToPngs(
    outDir: string,
    jsonConfig: GrapherInterface,
    vardata: MultipleOwidVariableDataDimensionsMap,
    optimizeSvgs = false
) {
    const grapher = new Grapher({ ...jsonConfig, manuallyProvideData: true })
    grapher.isExportingtoSvgOrPng = true
    grapher.receiveOwidData(vardata)
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

export async function getGraphersAndRedirectsBySlug() {
    const { graphersBySlug, graphersById } = await getPublishedGraphersBySlug()

    const redirectQuery = db.queryMysql(
        `SELECT slug, chart_id FROM chart_slug_redirects`
    )

    for (const row of await redirectQuery) {
        const grapher = graphersById.get(row.chart_id)
        if (grapher) {
            graphersBySlug.set(row.slug, grapher)
        }
    }

    return graphersBySlug
}

export async function getPublishedGraphersBySlug(
    includePrivate: boolean = false
) {
    const graphersBySlug: Map<string, GrapherInterface> = new Map()
    const graphersById: Map<number, GrapherInterface> = new Map()

    // Select all graphers that are published and that do not have the tag Private
    const sql = includePrivate
        ? `SELECT * FROM charts WHERE config->>"$.isPublished" = "true"`
        : `SELECT charts.id as id, charts.config as config FROM charts
LEFT JOIN chart_tags on chart_tags.chartId = charts.id
LEFT JOIN tags on tags.id = chart_tags.tagid
WHERE config->>"$.isPublished" = "true"
AND (tags.name IS NULL OR tags.name != 'Private')`

    const query = db.queryMysql(sql)
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
    const grapher = initGrapherForSvgExport(jsonConfig, queryStr)
    const { width, height } = grapher.idealBounds
    const outPath = buildSvgOutFilepath(
        slug,
        outDir,
        jsonConfig.version,
        width,
        height,
        verbose,
        queryStr
    )

    if (fs.existsSync(outPath) && !overwriteExisting) return
    const variableIds = grapher.dimensions.map((d) => d.variableId)
    const vardata = await getDataForMultipleVariables(variableIds)
    grapher.receiveOwidData(vardata)

    let svgCode = grapher.staticSVG
    if (optimizeSvgs) svgCode = await optimizeSvg(svgCode)

    fs.writeFile(outPath, svgCode)
    return svgCode
}

export function initGrapherForSvgExport(
    jsonConfig: GrapherInterface,
    queryStr: string = ""
) {
    const grapher = new Grapher({
        ...jsonConfig,
        manuallyProvideData: true,
        queryStr,
    })
    grapher.isExportingtoSvgOrPng = true
    return grapher
}

export function buildSvgOutFilename(
    slug: string,
    version: number | undefined,
    width: number,
    height: number,
    queryStr: string = ""
) {
    const fileKey = grapherSlugToExportFileKey(slug, queryStr)
    const outFilename = `${fileKey}_v${version}_${width}x${height}.svg`
    return outFilename
}

export function buildSvgOutFilepath(
    slug: string,
    outDir: string,
    version: number | undefined,
    width: number,
    height: number,
    verbose: boolean,
    queryStr: string = ""
) {
    const outFilename = buildSvgOutFilename(
        slug,
        version,
        width,
        height,
        queryStr
    )
    const outPath = path.join(outDir, outFilename)
    if (verbose) console.log(outPath)
    return outPath
}

export async function bakeGraphersToSvgs(
    grapherUrls: string[],
    outDir: string,
    optimizeSvgs = false
) {
    await fs.mkdirp(outDir)
    const graphersBySlug = await getGraphersAndRedirectsBySlug()

    return Promise.all(
        Array.from(grapherUrls).map((grapherUrl) => {
            const { slug, queryStr } = grapherUrlToSlugAndQueryStr(grapherUrl)
            const jsonConfig = graphersBySlug.get(slug)
            if (jsonConfig) {
                return bakeGrapherToSvg(
                    jsonConfig,
                    outDir,
                    slug,
                    queryStr,
                    optimizeSvgs
                )
            }
            return undefined
        })
    )
}

const svgoConfig: svgo.OptimizeOptions = {
    floatPrecision: 2,
    plugins: [
        {
            name: "preset-default",
            params: {
                overrides: {
                    // disable certain plugins
                    collapseGroups: false, // breaks the "Our World in Data" logo in the upper right
                    removeUnknownsAndDefaults: false, // would remove hrefs from links (<a>)
                    removeViewBox: false,
                },
            },
        },
    ],
}

async function optimizeSvg(svgString: string): Promise<string> {
    const optimizedSvg = await svgo.optimize(svgString, svgoConfig)
    return optimizedSvg.data
}

export async function grapherToSVG(
    jsonConfig: GrapherInterface,
    vardata: MultipleOwidVariableDataDimensionsMap
): Promise<string> {
    const grapher = new Grapher({ ...jsonConfig, manuallyProvideData: true })
    grapher.isExportingtoSvgOrPng = true
    grapher.receiveOwidData(vardata)
    return grapher.staticSVG
}
