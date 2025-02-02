import {
    DbPlainChartSlugRedirect,
    DbPlainChart,
    GrapherInterface,
    DbRawChartConfig,
} from "@ourworldindata/types"
import {
    fetchInputTableForConfig,
    Grapher,
    GrapherProgrammaticInterface,
    GrapherState,
} from "@ourworldindata/grapher"
import * as db from "../db/db.js"
import { grapherSlugToExportFileKey } from "./GrapherBakingUtils.js"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { DATA_API_URL } from "../settings/serverSettings.js"

interface SvgFilenameFragments {
    slug: string
    version: number
    width: number
    height: number
    queryStr?: string
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

export function initGrapherForSvgExport(
    jsonConfig: GrapherProgrammaticInterface,
    queryStr: string = ""
) {
    const grapher = new Grapher({
        grapherState: new GrapherState({
            bakedGrapherURL: BAKED_GRAPHER_URL,
            ...jsonConfig,
            manuallyProvideData: true,
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

export async function grapherToSVG(
    jsonConfig: GrapherInterface
    // vardata: MultipleOwidVariableDataDimensionsMap
): Promise<string> {
    const grapher = new Grapher({
        grapherState: new GrapherState({
            ...jsonConfig,
            manuallyProvideData: true,
        }),
    })
    grapher.grapherState.isExportingToSvgOrPng = true
    grapher.grapherState.shouldIncludeDetailsInStaticExport = false
    // grapher.receiveOwidData(vardata)
    const inputTable = await fetchInputTableForConfig(
        jsonConfig.dimensions ?? [],
        jsonConfig.selectedEntityColors,
        DATA_API_URL
    )
    if (inputTable) grapher.grapherState.inputTable = inputTable
    return grapher.staticSVG
}
