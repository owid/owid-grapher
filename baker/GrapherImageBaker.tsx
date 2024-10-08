import {
    DbPlainChartSlugRedirect,
    DbPlainChart,
    GrapherInterface,
    DbRawChartConfig,
} from "@ourworldindata/types"
import { Grapher, GrapherProgrammaticInterface } from "@ourworldindata/grapher"
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
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"

interface SvgFilenameFragments {
    slug: string
    version: number
    width: number
    height: number
    queryStr?: string
}

export async function bakeGrapherToSvgAndPng(
    outDir: string,
    jsonConfig: GrapherInterface,
    vardata: MultipleOwidVariableDataDimensionsMap,
    optimizeSvgs = false
) {
    const grapher = initGrapherForSvgExport(jsonConfig)
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
            .resize(grapher.defaultBounds.width, grapher.defaultBounds.height)
            .flatten({ background: "#ffffff" })
            .toFile(`${outPath}.png`),
    ])
}

export async function getGraphersAndRedirectsBySlug(
    knex: db.KnexReadonlyTransaction
) {
    const { graphersBySlug, graphersById } =
        await getPublishedGraphersBySlug(knex)

    const redirectQuery = await db.knexRaw<
        Pick<DbPlainChartSlugRedirect, "slug" | "chart_id">
    >(knex, `SELECT slug, chart_id FROM chart_slug_redirects`)

    for (const row of redirectQuery) {
        const grapher = graphersById.get(row.chart_id)
        if (grapher) {
            graphersBySlug.set(row.slug, grapher)
        }
    }

    return graphersBySlug
}

export async function getPublishedGraphersBySlug(
    knex: db.KnexReadonlyTransaction
) {
    const graphersBySlug: Map<string, GrapherInterface> = new Map()
    const graphersById: Map<number, GrapherInterface> = new Map()

    // Select all graphers that are published
    const sql = `-- sql
        SELECT c.id, cc.full as config
        FROM charts c
        JOIN chart_configs cc ON c.configId = cc.id
        WHERE cc.full ->> "$.isPublished" = 'true'
    `

    const query = db.knexRaw<
        Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
    >(knex, sql)
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
    const { width, height } = grapher.defaultBounds
    const outPath = buildSvgOutFilepath(
        outDir,
        {
            slug,
            version: jsonConfig.version ?? 0,
            width,
            height,
            queryStr,
        },
        verbose
    )

    if (fs.existsSync(outPath) && !overwriteExisting) return
    const variableIds = grapher.dimensions.map((d) => d.variableId)
    const vardata = await getDataForMultipleVariables(variableIds)
    grapher.receiveOwidData(vardata)

    let svgCode = grapher.staticSVG
    if (optimizeSvgs) svgCode = await optimizeSvg(svgCode)

    await fs.writeFile(outPath, svgCode)
    return svgCode
}

export function initGrapherForSvgExport(
    jsonConfig: GrapherProgrammaticInterface,
    queryStr: string = ""
) {
    const grapher = new Grapher({
        bakedGrapherURL: BAKED_GRAPHER_URL,
        ...jsonConfig,
        manuallyProvideData: true,
        queryStr,
    })
    grapher.isExportingToSvgOrPng = true
    grapher.shouldIncludeDetailsInStaticExport = false
    return grapher
}

export function buildSvgOutFilename(
    fragments: SvgFilenameFragments,
    {
        shouldHashQueryStr = true,
        separator = "-",
    }: { shouldHashQueryStr?: boolean; separator?: string } = {}
): string {
    const { slug, version, width, height, queryStr = "" } = fragments
    const fileKey = grapherSlugToExportFileKey(slug, queryStr, {
        shouldHashQueryStr,
        separator,
    })
    const outFilename = `${fileKey}_v${version}_${width}x${height}.svg`
    return outFilename
}

export function buildSvgOutFilepath(
    outDir: string,
    fragments: SvgFilenameFragments,
    verbose: boolean = false
) {
    const outFilename = buildSvgOutFilename(fragments)
    const outPath = path.join(outDir, outFilename)
    if (verbose) console.log(outPath)
    return outPath
}

export async function bakeGraphersToSvgs(
    knex: db.KnexReadonlyTransaction,
    grapherUrls: string[],
    outDir: string,
    optimizeSvgs = false
) {
    await fs.mkdirp(outDir)
    const graphersBySlug = await getGraphersAndRedirectsBySlug(knex)

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
