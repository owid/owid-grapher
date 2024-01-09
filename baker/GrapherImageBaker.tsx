import {
    Grapher,
    GrapherInterface,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import { MultipleOwidVariableDataDimensionsMap } from "@ourworldindata/utils"
import fs from "fs-extra"
import path from "path"
import sharp from "sharp"
import svgo from "svgo"
import * as db from "../db/db.js"
import { getDataForMultipleVariables } from "../db/model/Variable.js"
import {
    grapherSlugToExportFileKey,
    grapherUrlToSlugAndQueryStr,
} from "./GrapherBakingUtils.js"
import pMap from "p-map"

export async function bakeGraphersToPngs(
    outDir: string,
    jsonConfig: GrapherInterface,
    vardata: MultipleOwidVariableDataDimensionsMap,
    optimizeSvgs = false
) {
    const grapher = new Grapher({ ...jsonConfig, manuallyProvideData: true })
    grapher.isExportingToSvgOrPng = true
    grapher.shouldIncludeDetailsInStaticExport = false
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

export async function getPublishedGraphersBySlug() {
    const graphersBySlug: Map<string, GrapherInterface> = new Map()
    const graphersById: Map<number, GrapherInterface> = new Map()

    // Select all graphers that are published
    const sql = `SELECT id, config FROM charts WHERE config->>"$.isPublished" = "true"`

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
    jsonConfig: GrapherProgrammaticInterface,
    queryStr: string = ""
) {
    const grapher = new Grapher({
        ...jsonConfig,
        manuallyProvideData: true,
        queryStr,
    })
    grapher.isExportingToSvgOrPng = true
    grapher.shouldIncludeDetailsInStaticExport = false
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

    return pMap(
        grapherUrls,
        async (grapherUrl) => {
            const { slug, queryStr } = grapherUrlToSlugAndQueryStr(grapherUrl)
            const jsonConfig = graphersBySlug.get(slug)
            if (jsonConfig) {
                return await bakeGrapherToSvg(
                    jsonConfig,
                    outDir,
                    slug,
                    queryStr,
                    optimizeSvgs
                )
            }
            return undefined
        },
        { concurrency: 10 }
    )
}

const svgoConfig: svgo.Config = {
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
    grapher.isExportingToSvgOrPng = true
    grapher.shouldIncludeDetailsInStaticExport = false
    grapher.receiveOwidData(vardata)
    return grapher.staticSVG
}
