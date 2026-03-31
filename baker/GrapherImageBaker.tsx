import {
    DbPlainChart,
    GrapherInterface,
    DbRawChartConfig,
} from "@ourworldindata/types"
import {
    fetchInputTableForConfig,
    Grapher,
    GrapherProgrammaticInterface,
    GrapherState,
    GRAPHER_IMAGE_WIDTH_2X,
} from "@ourworldindata/grapher"
import * as db from "../db/db.js"
import { grapherSlugToExportFileKey } from "./GrapherBakingUtils.js"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { DATA_API_URL } from "../settings/serverSettings.js"
import ReactDOMServer from "react-dom/server"
import sharp from "sharp"

interface SvgFilenameFragments {
    slug: string
    version: number
    width: number
    height: number
    queryStr?: string
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

export function initGrapherForSvgExport(
    jsonConfig: GrapherProgrammaticInterface,
    queryStr: string = ""
) {
    const grapher = new Grapher({
        grapherState: new GrapherState({
            bakedGrapherURL: BAKED_GRAPHER_URL,
            ...jsonConfig,
            queryStr,
        }),
    })
    grapher.grapherState.isExportingToSvgOrPng = true
    grapher.grapherState.shouldIncludeDetailsInStaticExport = false
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

export async function grapherToSVG(
    jsonConfig: GrapherInterface
    // vardata: MultipleOwidVariableDataDimensionsMap
): Promise<string> {
    const grapher = new Grapher({
        grapherState: new GrapherState({
            ...jsonConfig,
        }),
    })
    grapher.grapherState.isExportingToSvgOrPng = true
    grapher.grapherState.shouldIncludeDetailsInStaticExport = false
    // grapher.receiveOwidData(vardata)
    const inputTable = await fetchInputTableForConfig({
        dimensions: jsonConfig.dimensions ?? [],
        selectedEntityColors: jsonConfig.selectedEntityColors,
        dataApiUrl: DATA_API_URL,
        noCache: false,
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable
    return grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
}

// NOTE: To ensure the correct fonts are used in the generated PNG, the fonts
// referenced in the SVG must be installed locally.
export async function grapherToPng(
    jsonConfig: GrapherInterface,
    width: number = GRAPHER_IMAGE_WIDTH_2X
): Promise<Buffer> {
    const svg = await grapherToSVG(jsonConfig)
    return await sharp(Buffer.from(svg), { density: 144 })
        .png()
        .resize(width)
        .flatten({ background: "#ffffff" })
        .toBuffer()
}
