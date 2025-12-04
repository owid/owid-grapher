import * as _ from "lodash-es"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import {
    DbPlainMultiDimDataPage,
    DbPlainExplorer,
    JsonString,
    MultiDimDataPagesTableName,
    MultiDimDataPageConfigEnriched,
    ExplorersTableName,
    PostsGdocsTableName,
    GrapherChecksumsObjectWithHash,
    GrapherChecksums,
    MultiDimChecksums,
    MultiDimChecksumsObjectWithHash,
    ExplorerChecksums,
    ExplorerChecksumsObjectWithHash,
    PostChecksums,
    PostChecksumsObjectWithHash,
    IndicatorChecksums,
    NarrativeChartChecksums,
    NarrativeChartChecksumsResult,
    ExplorerVariablesTableName,
    DbPlainExplorerVariable,
    VariablesTableName,
    DbRawVariable,
    DbRawPostGdoc,
    OwidGdocType,
    parseChartConfig,
    PostsGdocsLinksTableName,
    DbPlainPostGdocLink,
    ContentGraphLinkType,
    DbRawImage,
    ImagesTableName,
} from "@ourworldindata/types"
import * as db from "../../db.js"
import { stringify } from "safe-stable-stringify"
import { hashHex } from "../../../serverUtils/hash.js"
import { getAllVariableIds } from "@ourworldindata/utils"
import { getLatestArchivedChartVersionHashes } from "../ArchivedChartVersion.js"
import { getLatestArchivedExplorerVersionHashes } from "../ArchivedExplorerVersion.js"
import { getLatestArchivedMultiDimVersionHashes } from "../ArchivedMultiDimVersion.js"
import { getLatestArchivedPostVersionHashes } from "../ArchivedPostVersion.js"
import { getGdocBaseObjectById } from "../Gdoc/GdocFactory.js"
import { GdocPost } from "../Gdoc/GdocPost.js"
import { getMultiDimRedirectTargets } from "../MultiDimRedirects.js"

export interface ArchivalImage {
    id: number
    cloudflareId: string
    filename: string
    hash: string
    originalWidth: number
}

type VariableChecksums = Pick<DbRawVariable, "id"> & {
    // All variables used in production should have checksums.
    metadataChecksum: string
    dataChecksum: string
}

// Fetches checksum/hash information about all published charts from the database
export const getGrapherChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<GrapherChecksumsObjectWithHash[]> => {
    type FlatGrapherChecksums = {
        chartId: number
        chartSlug: string
        chartConfigMd5: string
        indicators: JsonString
    }

    const rows: GrapherChecksumsObjectWithHash[] = await db
        .knexRaw<FlatGrapherChecksums>(
            knex,
            // This query gets all published charts and their hashes, and all associated variables (keyed by variableId) and their checksums
            `-- sql
        SELECT
            c.id AS chartId,
            cc.slug AS chartSlug,
            cc.fullMd5 AS chartConfigMd5,
            JSON_OBJECTAGG(v.id, JSON_OBJECT("metadataChecksum", v.metadataChecksum, "dataChecksum", v.dataChecksum)) AS indicators
        FROM charts c
        JOIN chart_configs cc on c.configId = cc.id
        JOIN chart_dimensions cd on cd.chartId = c.id
        JOIN variables v on cd.variableId = v.id
        WHERE cc.full ->> "$.isPublished" = "true"
        ${slugs ? `AND cc.slug IN (${slugs.map(() => "?").join(",")})` : ""}
        GROUP BY c.id
        ORDER BY c.id
        `,
            slugs ?? []
        )
        .then((row) =>
            row.map((r) => ({
                chartId: r.chartId,
                chartSlug: r.chartSlug,
                checksums: {
                    chartConfigMd5: r.chartConfigMd5,
                    indicators: JSON.parse(r.indicators),
                },
            }))
        )
        .then((row) =>
            row.map((r) => ({
                ...r,
                checksumsHashed: hashGrapherChecksumsObj(r.checksums),
            }))
        )

    return rows
}

const hashGrapherChecksumsObj = (checksums: GrapherChecksums): string => {
    const stringified = stringify(
        _.pick(checksums, "chartConfigMd5", "indicators")
    )
    const hashed = hashHex(stringified, null)
    return hashed
}

const hashMultiDimChecksumsObj = (checksums: MultiDimChecksums): string => {
    const stringified = stringify(
        _.pick(checksums, "multiDimConfigMd5", "chartConfigs", "indicators")
    )
    const hashed = hashHex(stringified, null)
    return hashed
}

const hashExplorerChecksumsObj = (checksums: ExplorerChecksums): string => {
    const stringified = stringify(
        _.pick(checksums, "explorerConfigMd5", "chartConfigs", "indicators")
    )
    const hashed = hashHex(stringified, null)
    return hashed
}

const hashPostChecksumsObj = (checksums: PostChecksums): string => {
    const stringified = stringify(
        _.pick(
            checksums,
            "postContentMd5",
            "indicators",
            "graphers",
            "explorers",
            "multiDims",
            "narrativeCharts",
            "images"
        )
    )
    const hashed = hashHex(stringified, null)
    return hashed
}

export const findChangedGrapherPages = async (
    knex: db.KnexReadonlyTransaction
): Promise<GrapherChecksumsObjectWithHash[]> => {
    const allChartChecksums = await getGrapherChecksumsFromDb(knex)

    // We're gonna find the hashes of all the graphers that are already archived and up-to-date
    const chartIds = allChartChecksums.map((c) => c.chartId)
    const hashesFoundInDb =
        chartIds.length > 0
            ? await getLatestArchivedChartVersionHashes(knex, chartIds)
            : new Map<number, string>()
    const [alreadyArchived, needToBeArchived] = _.partition(
        allChartChecksums,
        (c) => hashesFoundInDb.get(c.chartId) === c.checksumsHashed
    )

    console.log("total published graphers", allChartChecksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

export const findChangedMultiDimPages = async (
    knex: db.KnexReadonlyTransaction
): Promise<MultiDimChecksumsObjectWithHash[]> => {
    const allMultiDimChecksums = await getMultiDimChecksumsFromDb(knex)

    // We're gonna find the hashes of all the multi-dim pages that are already archived and up-to-date
    const multiDimIds = allMultiDimChecksums.map((c) => c.multiDimId)
    const hashesFoundInDb =
        multiDimIds.length > 0
            ? await getLatestArchivedMultiDimVersionHashes(knex, multiDimIds)
            : new Map<number, string>()
    const [alreadyArchived, needToBeArchived] = _.partition(
        allMultiDimChecksums,
        (c) => hashesFoundInDb.get(c.multiDimId) === c.checksumsHashed
    )

    console.log("total published multi-dim pages", allMultiDimChecksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

// Fetches checksum/hash information about all published multi-dim data pages from the database
export const getMultiDimChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<MultiDimChecksumsObjectWithHash[]> => {
    // Get all published multi-dim data pages
    const multiDimPagesQuery = knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("id", "slug", "config", "configMd5")
        .where("published", true)
        .orderBy("id")

    if (slugs) {
        multiDimPagesQuery.whereIn("slug", slugs)
    }

    const multiDimPages = await multiDimPagesQuery

    if (multiDimPages.length === 0) return []

    // Get chart config MD5s for each multi-dim page
    type ChartConfigResult = {
        multiDimId: number
        chartConfigId: string
        chartConfigMd5: string
    }

    const chartConfigRows = await db.knexRaw<ChartConfigResult>(
        knex,
        `-- sql
        SELECT
            mdxcc.multiDimId,
            mdxcc.chartConfigId,
            cc.fullMd5 AS chartConfigMd5
        FROM multi_dim_x_chart_configs mdxcc
        JOIN chart_configs cc ON mdxcc.chartConfigId = cc.id
        WHERE mdxcc.multiDimId IN (${multiDimPages.map(() => "?").join(",")})`,
        multiDimPages.map((p) => p.id)
    )

    // Group chart configs by multiDimId
    const chartConfigsByMultiDimId = new Map<number, Record<string, string>>()
    for (const row of chartConfigRows) {
        if (!chartConfigsByMultiDimId.has(row.multiDimId)) {
            chartConfigsByMultiDimId.set(row.multiDimId, {})
        }
        chartConfigsByMultiDimId.get(row.multiDimId)![row.chartConfigId] =
            row.chartConfigMd5
    }

    // Extract all variable IDs from configs
    let allVariableIds = new Set<number>()
    const configsByMultiDimId = new Map<
        number,
        MultiDimDataPageConfigEnriched
    >()

    for (const page of multiDimPages) {
        const config: MultiDimDataPageConfigEnriched = JSON.parse(page.config)
        configsByMultiDimId.set(page.id, config)
        allVariableIds = allVariableIds.union(getAllVariableIds(config.views))
    }

    // Get variable checksums
    const variableChecksums = await knex<VariableChecksums>(VariablesTableName)
        .select("id", "metadataChecksum", "dataChecksum")
        .whereIn("id", [...allVariableIds])

    const variableChecksumsMap = new Map(
        variableChecksums.map((v) => [
            v.id.toString(),
            {
                metadataChecksum: v.metadataChecksum,
                dataChecksum: v.dataChecksum,
            },
        ])
    )

    // Build result
    return await Promise.all(
        multiDimPages.map(async (page) => {
            const config = configsByMultiDimId.get(page.id)!
            const chartConfigs = chartConfigsByMultiDimId.get(page.id) || {}

            // Get indicators used in this multi-dim page
            const usedVariableIds = getAllVariableIds(config.views)

            const indicators: {
                [id: string]: { metadataChecksum: string; dataChecksum: string }
            } = {}
            for (const variableId of usedVariableIds) {
                const checksum = variableChecksumsMap.get(variableId.toString())
                if (checksum) {
                    indicators[variableId.toString()] = checksum
                } else {
                    await logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Variable ${variableId} is missing a checksum`
                        )
                    )
                }
            }

            const checksums: MultiDimChecksums = {
                multiDimConfigMd5: page.configMd5,
                chartConfigs,
                indicators,
            }

            return {
                multiDimId: page.id,
                multiDimSlug: page.slug || "",
                checksums,
                checksumsHashed: hashMultiDimChecksumsObj(checksums),
            }
        })
    )
}

export const getExplorerChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<ExplorerChecksumsObjectWithHash[]> => {
    // Get all published explorers that are either indicator-based or grapher-based
    // (excludes CSV-based explorers that have no variables or charts)
    const explorersQuery = knex<DbPlainExplorer>(ExplorersTableName)
        .select("slug", "config", "configMd5")
        .where("isPublished", true)
        .where(function () {
            this.whereExists(function () {
                this.select("*")
                    .from(ExplorerVariablesTableName)
                    .whereRaw("explorerSlug = explorers.slug")
            }).orWhereExists(function () {
                this.select("*")
                    .from("explorer_charts")
                    .whereRaw("explorerSlug = explorers.slug")
            })
        })
        .orderBy("slug")

    if (slugs) {
        explorersQuery.whereIn("slug", slugs)
    }

    const explorers = await explorersQuery

    if (explorers.length === 0) return []

    type ViewConfigResult = {
        explorerSlug: string
        chartConfigId: string
        chartConfigMd5: string
        chartConfigFull: string
    }

    const viewConfigRows = await db.knexRaw<ViewConfigResult>(
        knex,
        `-- sql
        SELECT
            ev.explorerSlug,
            ev.chartConfigId,
            cc.fullMd5 AS chartConfigMd5,
            cc.full AS chartConfigFull
        FROM explorer_views ev
        JOIN chart_configs cc ON ev.chartConfigId = cc.id
        WHERE ev.chartConfigId IS NOT NULL
          AND ev.explorerSlug IN (${explorers.map(() => "?").join(",")})`,
        explorers.map((e) => e.slug)
    )

    // Group per-view chart configs by explorerSlug (chartConfigId -> MD5)
    const chartConfigsByExplorerSlug = new Map<string, Record<string, string>>()
    for (const row of viewConfigRows) {
        if (!chartConfigsByExplorerSlug.has(row.explorerSlug)) {
            chartConfigsByExplorerSlug.set(row.explorerSlug, {})
        }
        chartConfigsByExplorerSlug.get(row.explorerSlug)![row.chartConfigId] =
            row.chartConfigMd5
    }

    // Get variable IDs used by explorers
    // 1) From explorer_variables (indicator-based references captured by config)
    const allVariableIds = new Set<number>()
    const variablesByExplorerSlug = new Map<string, Set<number>>()

    const explorerVariableRows = await knex<DbPlainExplorerVariable>(
        ExplorerVariablesTableName
    )
        .select("explorerSlug", "variableId")
        .whereIn(
            "explorerSlug",
            explorers.map((e) => e.slug)
        )

    for (const row of explorerVariableRows) {
        if (!variablesByExplorerSlug.has(row.explorerSlug)) {
            variablesByExplorerSlug.set(row.explorerSlug, new Set<number>())
        }
        variablesByExplorerSlug.get(row.explorerSlug)!.add(row.variableId)
        allVariableIds.add(row.variableId)
    }

    // 2) From generated explorer view configs (both grapher- and indicator-based)
    for (const row of viewConfigRows) {
        const slug = row.explorerSlug
        if (!variablesByExplorerSlug.has(slug)) {
            variablesByExplorerSlug.set(slug, new Set<number>())
        }
        const config = parseChartConfig(row.chartConfigFull)
        if (config.dimensions) {
            for (const dimension of config.dimensions) {
                const variableId = dimension.variableId
                variablesByExplorerSlug.get(slug)?.add(variableId)
                allVariableIds.add(variableId)
            }
        }
    }

    // Get variable checksums
    const variableChecksums = await knex<VariableChecksums>(VariablesTableName)
        .select("id", "metadataChecksum", "dataChecksum")
        .whereIn("id", [...allVariableIds])

    const variableChecksumsMap = new Map(
        variableChecksums.map((v) => [
            v.id.toString(),
            {
                metadataChecksum: v.metadataChecksum,
                dataChecksum: v.dataChecksum,
            },
        ])
    )

    return await Promise.all(
        explorers.map(async (explorer) => {
            const chartConfigs =
                chartConfigsByExplorerSlug.get(explorer.slug) || {}
            const usedVariableIds = [
                ...(variablesByExplorerSlug.get(explorer.slug) || []),
            ]

            const indicators: {
                [id: string]: { metadataChecksum: string; dataChecksum: string }
            } = {}
            for (const variableId of usedVariableIds) {
                const checksum = variableChecksumsMap.get(variableId.toString())
                if (checksum) {
                    indicators[variableId.toString()] = checksum
                } else {
                    await logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Variable ${variableId} is missing a checksum`
                        )
                    )
                }
            }

            const checksums: ExplorerChecksums = {
                explorerConfigMd5: explorer.configMd5,
                chartConfigs,
                indicators,
            }

            return {
                explorerSlug: explorer.slug,
                checksums,
                checksumsHashed: hashExplorerChecksumsObj(checksums),
            }
        })
    )
}

export const getNarrativeChartChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    names?: string[]
): Promise<NarrativeChartChecksumsResult[]> => {
    type NarrativeChartRow = {
        id: number
        name: string
        chartConfigMd5: string
        queryParamsForParentChartMd5: string
        config: JsonString
    }

    // First, get narrative charts with their configs
    const query = knex("narrative_charts as nc")
        .select(
            "nc.id",
            "nc.name",
            "cc.fullMd5 as chartConfigMd5",
            "nc.queryParamsForParentChartMd5",
            "cc.full as config"
        )
        .join("chart_configs as cc", "nc.chartConfigId", "cc.id")

    if (names && names.length > 0) {
        query.whereIn("nc.name", names)
    }

    const narrativeCharts = await query

    // Extract variable IDs from configs
    const allVariableIds = new Set<number>()
    for (const chart of narrativeCharts) {
        const config = JSON.parse(chart.config)
        if (config.dimensions) {
            for (const dim of config.dimensions) {
                if (dim.variableId) {
                    allVariableIds.add(dim.variableId)
                }
            }
        }
    }

    // Fetch variable checksums
    const variables =
        allVariableIds.size > 0
            ? await knex("variables")
                  .select("id", "metadataChecksum", "dataChecksum")
                  .whereIn("id", Array.from(allVariableIds))
            : []

    const variableChecksumsMap = new Map(
        variables.map((v) => [
            v.id,
            {
                metadataChecksum: v.metadataChecksum,
                dataChecksum: v.dataChecksum,
            },
        ])
    )

    // Build result with indicators
    return narrativeCharts.map((chart: NarrativeChartRow) => {
        const config = JSON.parse(chart.config)
        const indicators: IndicatorChecksums = {}

        if (config.dimensions) {
            for (const dim of config.dimensions) {
                if (dim.variableId) {
                    const checksums = variableChecksumsMap.get(dim.variableId)
                    if (checksums) {
                        indicators[dim.variableId] = checksums
                    }
                }
            }
        }

        const checksums: NarrativeChartChecksums = {
            chartConfigMd5: chart.chartConfigMd5,
            queryParamsForParentChartMd5: chart.queryParamsForParentChartMd5,
            indicators,
        }

        return {
            narrativeChartId: chart.id,
            narrativeChartName: chart.name,
            checksums,
        }
    })
}

export const findChangedExplorerPages = async (
    knex: db.KnexReadonlyTransaction
): Promise<ExplorerChecksumsObjectWithHash[]> => {
    const allExplorerChecksums = await getExplorerChecksumsFromDb(knex)

    // We're gonna find the hashes of all the explorers that are already archived and up-to-date
    const explorerSlugs = allExplorerChecksums.map((c) => c.explorerSlug)
    const hashesFoundInDb =
        explorerSlugs.length > 0
            ? await getLatestArchivedExplorerVersionHashes(knex, explorerSlugs)
            : new Map<string, string>()
    const [alreadyArchived, needToBeArchived] = _.partition(
        allExplorerChecksums,
        (c) => hashesFoundInDb.get(c.explorerSlug) === c.checksumsHashed
    )

    console.log("total published explorers", allExplorerChecksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

type LinkedChart = Pick<DbPlainPostGdocLink, "sourceId" | "linkType" | "target">

interface ChartsByPost {
    grapher: Set<string>
    explorer: Set<string>
    narrativeChart: Set<string>
}

// Represents the resolved type and target slug after following redirects
type ResolvedSlug =
    | { type: "grapher"; slug: string }
    | { type: "multiDim"; slug: string }
    | { type: "explorer"; slug: string }

async function getLinkedChartsFromPosts(
    knex: db.KnexReadonlyTransaction,
    postIds: string[]
): Promise<LinkedChart[]> {
    if (postIds.length === 0) return []
    return await knex<DbPlainPostGdocLink>(PostsGdocsLinksTableName)
        .distinct("sourceId", "linkType", "target")
        .whereIn("sourceId", postIds)
        .whereIn("linkType", [
            ContentGraphLinkType.Grapher,
            ContentGraphLinkType.Explorer,
            ContentGraphLinkType.NarrativeChart,
        ])
        .whereIn("componentType", ["chart", "narrative-chart"])
}

function groupLinkedChartsByPost(
    posts: Pick<DbRawPostGdoc, "id">[],
    linkedCharts: LinkedChart[]
): Map<string, ChartsByPost> {
    const chartsByPost = new Map<string, ChartsByPost>()

    for (const post of posts) {
        chartsByPost.set(post.id, {
            grapher: new Set<string>(),
            explorer: new Set<string>(),
            narrativeChart: new Set<string>(),
        })
    }

    for (const link of linkedCharts) {
        const postCharts = chartsByPost.get(link.sourceId)
        if (postCharts) {
            if (link.linkType === ContentGraphLinkType.Grapher) {
                postCharts.grapher.add(link.target)
            } else if (link.linkType === ContentGraphLinkType.Explorer) {
                postCharts.explorer.add(link.target)
            } else if (link.linkType === ContentGraphLinkType.NarrativeChart) {
                postCharts.narrativeChart.add(link.target)
            }
        }
    }

    return chartsByPost
}

export async function getImagesByPostId(
    knex: db.KnexReadonlyTransaction,
    postIds: string[]
): Promise<Record<string, ArchivalImage[]>> {
    const imagesByPostId: Record<string, ArchivalImage[]> = {}
    if (postIds.length === 0) return imagesByPostId

    for (const postId of postIds) {
        const gdocBase = await getGdocBaseObjectById(knex, postId, false, true)
        if (!gdocBase) continue

        // Load only what's needed for linkedImageFilenames.
        const gdoc = GdocPost.create(gdocBase)
        await gdoc.loadLinkedDocuments(knex)

        // Collect all image filenames from both regular images and static viz
        const allFilenames: string[] = [...gdoc.linkedImageFilenames]

        // Also collect images from static viz components
        const staticVizNames = gdoc.linkedStaticVizNames
        if (staticVizNames.length > 0) {
            await gdoc.loadLinkedStaticViz(knex)

            for (const name of staticVizNames) {
                const staticViz = gdoc.linkedStaticViz?.[name]
                if (staticViz) {
                    allFilenames.push(staticViz.desktop.filename)
                    if (staticViz.mobile) {
                        allFilenames.push(staticViz.mobile.filename)
                    }
                }
            }
        }

        // Early exit if no images
        if (allFilenames.length === 0) continue

        // Single query for all images
        imagesByPostId[postId] = await knex<DbRawImage>(ImagesTableName)
            .select("id", "cloudflareId", "filename", "hash", "originalWidth")
            .where("replacedBy", null)
            .whereIn("filename", allFilenames)
    }

    return imagesByPostId
}

export async function getVideosByPostId(
    knex: db.KnexReadonlyTransaction,
    postIds: string[]
): Promise<Record<string, string[]>> {
    if (postIds.length === 0) return {}

    // We only care about video URLs for now and don't support re-archiving when
    // a different video is uploaded with the same URL.
    const videoComponents = await db.knexRaw<{
        gdocId: string
        url: string
    }>(
        knex,
        `-- sql
        SELECT
            gdocId,
            config ->> '$.url' AS url
        FROM posts_gdocs_components
        WHERE gdocId IN (${postIds.map(() => "?").join(",")})
        AND type = 'video'
        `,
        postIds
    )

    return _.mapValues(_.groupBy(videoComponents, "gdocId"), (components) =>
        components.map((c) => c.url)
    )
}

async function getVariableChecksumsForIds(
    knex: db.KnexReadonlyTransaction,
    variableIds: Set<number>
): Promise<Map<string, { metadataChecksum: string; dataChecksum: string }>> {
    if (variableIds.size === 0) {
        return new Map()
    }

    const variableChecksums = await knex<VariableChecksums>(VariablesTableName)
        .select("id", "metadataChecksum", "dataChecksum")
        .whereIn("id", Array.from(variableIds))

    return new Map(
        variableChecksums.map((v) => [
            v.id.toString(),
            {
                metadataChecksum: v.metadataChecksum,
                dataChecksum: v.dataChecksum,
            },
        ])
    )
}

async function resolveGrapherRedirects(
    knex: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<Map<string, string>> {
    const redirectMap = new Map<string, string>()
    if (slugs.length === 0) return redirectMap

    const redirects = await db.knexRaw<{
        oldSlug: string
        newSlug: string
    }>(
        knex,
        `-- sql
        SELECT
            csr.slug as oldSlug,
            cc.slug as newSlug
        FROM chart_slug_redirects csr
        INNER JOIN charts c ON c.id = csr.chart_id
        INNER JOIN chart_configs cc ON cc.id = c.configId
        WHERE csr.slug IN (${slugs.map(() => "?").join(",")})
        `,
        slugs
    )

    for (const slug of slugs) {
        redirectMap.set(slug, slug)
    }
    for (const redirect of redirects) {
        redirectMap.set(redirect.oldSlug, redirect.newSlug)
    }

    return redirectMap
}

async function resolveMultiDimRedirects(
    knex: db.KnexReadonlyTransaction,
    slugs: string[],
    sourcePrefix: "/grapher/" | "/explorers/"
): Promise<Map<string, string>> {
    const redirects = await getMultiDimRedirectTargets(
        knex,
        slugs,
        sourcePrefix
    )
    return new Map(
        Array.from(redirects, ([slug, redirect]) => [slug, redirect.targetSlug])
    )
}

/**
 * Classifies grapher slugs to their final content type.
 * A grapher slug may:
 *
 * 1. Stay as a grapher (found in grapherChecksumsMap)
 * 2. Redirect to a multi-dim page (explicit redirect in multiDimRedirectMap)
 * 3. Not exist as a chart but exist as a multi-dim
 */
function classifyGrapherSlugs(
    slugs: string[],
    grapherChecksumsMap: Map<string, GrapherChecksumsObjectWithHash>,
    multiDimRedirectMap: Map<string, string>
): Map<string, ResolvedSlug> {
    const result = new Map<string, ResolvedSlug>()
    for (const slug of slugs) {
        const multiDimTarget = multiDimRedirectMap.get(slug)
        if (multiDimTarget && multiDimTarget !== slug) {
            // Explicit redirect to multi-dim
            result.set(slug, { type: "multiDim", slug: multiDimTarget })
        } else if (grapherChecksumsMap.has(slug)) {
            // Found as a chart
            result.set(slug, { type: "grapher", slug })
        } else {
            // Not found as chart, treat as multi-dim (slug stays the same)
            result.set(slug, { type: "multiDim", slug })
        }
    }
    return result
}

/**
 * Classifies explorer slugs to their final content type.
 * An explorer slug may:
 *
 * 1. Stay as an explorer
 * 2. Redirect to a multi-dim
 */
function classifyExplorerSlugs(
    slugs: string[],
    multiDimRedirectMap: Map<string, string>
): Map<string, ResolvedSlug> {
    const result = new Map<string, ResolvedSlug>()
    for (const slug of slugs) {
        const multiDimTarget = multiDimRedirectMap.get(slug)
        if (multiDimTarget) {
            // Explicit redirect to multi-dim
            result.set(slug, { type: "multiDim", slug: multiDimTarget })
        } else {
            // Stays as explorer
            result.set(slug, { type: "explorer", slug })
        }
    }
    return result
}

/** Collects all variable IDs referenced in a set of indicator checksums. */
function collectVariableIdsFromIndicators(
    indicators: IndicatorChecksums
): Set<number> {
    return new Set(Object.keys(indicators).map((id) => parseInt(id)))
}

export async function getPostChecksumsFromDb(
    knex: db.KnexReadonlyTransaction
): Promise<{
    postChecksums: PostChecksumsObjectWithHash[]
    imagesByPostId: Record<string, ArchivalImage[]>
}> {
    // Phase 1: Fetch all posts and their linked content
    const posts = await knex<DbRawPostGdoc>(PostsGdocsTableName)
        .select("id", "slug", "contentMd5")
        .where("published", true)
        .where("publishedAt", "<=", knex.fn.now())
        .where("type", OwidGdocType.Article)

    if (posts.length === 0) return { postChecksums: [], imagesByPostId: {} }

    const postIds = posts.map((p) => p.id)
    const linkedCharts = await getLinkedChartsFromPosts(knex, postIds)
    const chartsByPost = groupLinkedChartsByPost(posts, linkedCharts)
    const imagesByPostId = await getImagesByPostId(knex, postIds)

    // Collect all unique slugs across all posts
    const allGrapherSlugs = new Set<string>()
    const allExplorerSlugs = new Set<string>()
    const allNarrativeChartNames = new Set<string>()
    for (const charts of chartsByPost.values()) {
        charts.grapher.forEach((slug) => allGrapherSlugs.add(slug))
        charts.explorer.forEach((slug) => allExplorerSlugs.add(slug))
        charts.narrativeChart.forEach((name) =>
            allNarrativeChartNames.add(name)
        )
    }

    // Phase 2: Resolve redirects and classify content types
    const { grapherChecksumsMap, multiDimChecksumsMap, grapherResolutions } =
        await resolveGrapherSlugsAndFetchChecksums(
            knex,
            Array.from(allGrapherSlugs)
        )

    const { explorerChecksumsMap, explorerResolutions } =
        await resolveExplorerSlugsAndFetchChecksums(
            knex,
            Array.from(allExplorerSlugs),
            multiDimChecksumsMap
        )

    const narrativeChartChecksumsMap = await fetchNarrativeChartChecksums(
        knex,
        Array.from(allNarrativeChartNames)
    )

    // Phase 3: Collect all variable IDs and fetch their checksums
    const allVariableIds = collectAllVariableIds(
        grapherChecksumsMap,
        multiDimChecksumsMap,
        explorerChecksumsMap,
        narrativeChartChecksumsMap
    )
    const variableChecksumsMap = await getVariableChecksumsForIds(
        knex,
        allVariableIds
    )

    // Phase 4: Build checksums for each post
    const postChecksums = posts.map((post) =>
        buildPostChecksums(
            post,
            chartsByPost.get(post.id)!,
            grapherResolutions,
            explorerResolutions,
            grapherChecksumsMap,
            multiDimChecksumsMap,
            explorerChecksumsMap,
            narrativeChartChecksumsMap,
            variableChecksumsMap,
            imagesByPostId[post.id] ?? []
        )
    )

    return { postChecksums, imagesByPostId }
}

/**
 * Resolves grapher slugs through redirects, then classifies each as either a
 * grapher or multi-dim page. Returns checksums for both types.
 */
async function resolveGrapherSlugsAndFetchChecksums(
    knex: db.KnexReadonlyTransaction,
    originalSlugs: string[]
): Promise<{
    grapherChecksumsMap: Map<string, GrapherChecksumsObjectWithHash>
    multiDimChecksumsMap: Map<string, MultiDimChecksumsObjectWithHash>
    grapherResolutions: Map<string, ResolvedSlug>
}> {
    if (originalSlugs.length === 0) {
        return {
            grapherChecksumsMap: new Map(),
            multiDimChecksumsMap: new Map(),
            grapherResolutions: new Map(),
        }
    }

    // Step 1: Follow chart slug redirects (e.g., old-slug -> new-slug)
    const chartRedirects = await resolveGrapherRedirects(knex, originalSlugs)
    const slugsAfterChartRedirects = new Set(
        originalSlugs.map((slug) => chartRedirects.get(slug) ?? slug)
    )

    // Step 2: Check for multi-dim redirects on the resolved slugs
    const multiDimRedirects = await resolveMultiDimRedirects(
        knex,
        Array.from(slugsAfterChartRedirects),
        "/grapher/"
    )

    // Step 3: Identify which slugs explicitly redirect to multi-dims
    const slugsRedirectingToMultiDim = new Set(
        Array.from(slugsAfterChartRedirects).filter((slug) =>
            multiDimRedirects.has(slug)
        )
    )

    // Step 4: Fetch chart checksums for slugs that don't redirect to multi-dims
    const slugsForChartLookup = Array.from(slugsAfterChartRedirects).filter(
        (slug) => !slugsRedirectingToMultiDim.has(slug)
    )
    const grapherChecksums = await getGrapherChecksumsFromDb(
        knex,
        slugsForChartLookup
    )
    const grapherChecksumsMap = new Map(
        grapherChecksums.map((c) => [c.chartSlug, c])
    )

    // Step 5: Classify each resolved slug and fetch multi-dim checksums
    const grapherResolutions = classifyGrapherSlugs(
        Array.from(slugsAfterChartRedirects),
        grapherChecksumsMap,
        multiDimRedirects
    )

    // Collect all multi-dim slugs (both from redirects and unresolved graphers)
    const multiDimSlugs = new Set<string>()
    for (const resolved of grapherResolutions.values()) {
        if (resolved.type === "multiDim") {
            multiDimSlugs.add(resolved.slug)
        }
    }

    const multiDimChecksums = await getMultiDimChecksumsFromDb(
        knex,
        Array.from(multiDimSlugs)
    )
    const multiDimChecksumsMap = new Map(
        multiDimChecksums.map((m) => [m.multiDimSlug, m])
    )

    // Build resolution map from original slugs to resolved content
    const finalResolutions = new Map<string, ResolvedSlug>()
    for (const originalSlug of originalSlugs) {
        const afterChartRedirect =
            chartRedirects.get(originalSlug) ?? originalSlug
        const resolved = grapherResolutions.get(afterChartRedirect)
        if (resolved) {
            finalResolutions.set(originalSlug, resolved)
        }
    }

    return {
        grapherChecksumsMap,
        multiDimChecksumsMap,
        grapherResolutions: finalResolutions,
    }
}

/**
 * Resolves explorer slugs, checking for multi-dim redirects.
 * Returns checksums and adds any new multi-dims to the provided map.
 */
async function resolveExplorerSlugsAndFetchChecksums(
    knex: db.KnexReadonlyTransaction,
    originalSlugs: string[],
    existingMultiDimMap: Map<string, MultiDimChecksumsObjectWithHash>
): Promise<{
    explorerChecksumsMap: Map<string, ExplorerChecksumsObjectWithHash>
    explorerResolutions: Map<string, ResolvedSlug>
}> {
    if (originalSlugs.length === 0) {
        return {
            explorerChecksumsMap: new Map(),
            explorerResolutions: new Map(),
        }
    }

    // Check for multi-dim redirects
    const multiDimRedirects = await resolveMultiDimRedirects(
        knex,
        originalSlugs,
        "/explorers/"
    )

    const slugsRedirectingToMultiDim = new Set(
        originalSlugs.filter((slug) => multiDimRedirects.has(slug))
    )

    // Fetch explorer checksums for non-redirected slugs
    const slugsForExplorerLookup = originalSlugs.filter(
        (slug) => !slugsRedirectingToMultiDim.has(slug)
    )
    const explorerChecksums = await getExplorerChecksumsFromDb(
        knex,
        slugsForExplorerLookup
    )
    const explorerChecksumsMap = new Map(
        explorerChecksums.map((e) => [e.explorerSlug, e])
    )

    // Fetch any new multi-dim checksums for redirected explorers
    const newMultiDimSlugs = Array.from(slugsRedirectingToMultiDim)
        .map((slug) => multiDimRedirects.get(slug)!)
        .filter((slug) => !existingMultiDimMap.has(slug))

    if (newMultiDimSlugs.length > 0) {
        const additionalMultiDims = await getMultiDimChecksumsFromDb(
            knex,
            newMultiDimSlugs
        )
        for (const checksum of additionalMultiDims) {
            existingMultiDimMap.set(checksum.multiDimSlug, checksum)
        }
    }

    // Build resolution map
    const explorerResolutions = classifyExplorerSlugs(
        originalSlugs,
        multiDimRedirects
    )

    return { explorerChecksumsMap, explorerResolutions }
}

async function fetchNarrativeChartChecksums(
    knex: db.KnexReadonlyTransaction,
    names: string[]
): Promise<Map<string, NarrativeChartChecksumsResult>> {
    const checksums = await getNarrativeChartChecksumsFromDb(knex, names)
    return new Map(checksums.map((nc) => [nc.narrativeChartName, nc]))
}

function collectAllVariableIds(
    grapherMap: Map<string, GrapherChecksumsObjectWithHash>,
    multiDimMap: Map<string, MultiDimChecksumsObjectWithHash>,
    explorerMap: Map<string, ExplorerChecksumsObjectWithHash>,
    narrativeChartMap: Map<string, NarrativeChartChecksumsResult>
): Set<number> {
    const allIds = new Set<number>()
    for (const grapher of grapherMap.values()) {
        collectVariableIdsFromIndicators(grapher.checksums.indicators).forEach(
            (id) => allIds.add(id)
        )
    }
    for (const multiDim of multiDimMap.values()) {
        collectVariableIdsFromIndicators(multiDim.checksums.indicators).forEach(
            (id) => allIds.add(id)
        )
    }
    for (const explorer of explorerMap.values()) {
        collectVariableIdsFromIndicators(explorer.checksums.indicators).forEach(
            (id) => allIds.add(id)
        )
    }
    for (const narrativeChart of narrativeChartMap.values()) {
        collectVariableIdsFromIndicators(
            narrativeChart.checksums.indicators
        ).forEach((id) => allIds.add(id))
    }
    return allIds
}

function buildPostChecksums(
    post: Pick<DbRawPostGdoc, "id" | "slug" | "contentMd5">,
    postCharts: ChartsByPost,
    grapherResolutions: Map<string, ResolvedSlug>,
    explorerResolutions: Map<string, ResolvedSlug>,
    grapherChecksumsMap: Map<string, GrapherChecksumsObjectWithHash>,
    multiDimChecksumsMap: Map<string, MultiDimChecksumsObjectWithHash>,
    explorerChecksumsMap: Map<string, ExplorerChecksumsObjectWithHash>,
    narrativeChartChecksumsMap: Map<string, NarrativeChartChecksumsResult>,
    variableChecksumsMap: Map<
        string,
        { metadataChecksum: string; dataChecksum: string }
    >,
    images: ArchivalImage[]
): PostChecksumsObjectWithHash {
    const graphers: Record<string, { slug: string; chartConfigMd5: string }> =
        {}
    const multiDims: Record<
        string,
        {
            slug: string
            multiDimConfigMd5: string
            chartConfigs: Record<string, string>
        }
    > = {}

    // Process grapher slugs based on their resolved type
    for (const originalSlug of postCharts.grapher) {
        const resolved = grapherResolutions.get(originalSlug)
        if (!resolved) continue

        if (resolved.type === "grapher") {
            const checksum = grapherChecksumsMap.get(resolved.slug)
            if (checksum) {
                graphers[checksum.chartId.toString()] = {
                    slug: checksum.chartSlug,
                    chartConfigMd5: checksum.checksums.chartConfigMd5,
                }
            }
        } else if (resolved.type === "multiDim") {
            const checksum = multiDimChecksumsMap.get(resolved.slug)
            if (checksum) {
                multiDims[checksum.multiDimId.toString()] = {
                    slug: checksum.multiDimSlug,
                    multiDimConfigMd5: checksum.checksums.multiDimConfigMd5,
                    chartConfigs: checksum.checksums.chartConfigs,
                }
            }
        }
    }

    // Process explorer slugs (may also resolve to multi-dims)
    const explorers: Record<
        string,
        { explorerConfigMd5: string; chartConfigs: Record<string, string> }
    > = {}

    for (const originalSlug of postCharts.explorer) {
        const resolved = explorerResolutions.get(originalSlug)
        if (!resolved) continue

        if (resolved.type === "explorer") {
            const checksum = explorerChecksumsMap.get(resolved.slug)
            if (checksum) {
                explorers[resolved.slug] = {
                    explorerConfigMd5: checksum.checksums.explorerConfigMd5,
                    chartConfigs: checksum.checksums.chartConfigs,
                }
            }
        } else if (resolved.type === "multiDim") {
            const checksum = multiDimChecksumsMap.get(resolved.slug)
            if (checksum) {
                multiDims[checksum.multiDimId.toString()] = {
                    slug: checksum.multiDimSlug,
                    multiDimConfigMd5: checksum.checksums.multiDimConfigMd5,
                    chartConfigs: checksum.checksums.chartConfigs,
                }
            }
        }
    }

    // Process narrative charts
    const narrativeCharts: Record<
        string,
        {
            name: string
            chartConfigMd5: string
            queryParamsForParentChartMd5: string
        }
    > = {}

    for (const name of postCharts.narrativeChart) {
        const checksum = narrativeChartChecksumsMap.get(name)
        if (checksum) {
            narrativeCharts[checksum.narrativeChartId.toString()] = {
                name: checksum.narrativeChartName,
                chartConfigMd5: checksum.checksums.chartConfigMd5,
                queryParamsForParentChartMd5:
                    checksum.checksums.queryParamsForParentChartMd5,
            }
        }
    }

    // Collect all indicators referenced by this post's content
    const postIndicators = collectPostIndicators(
        postCharts,
        grapherResolutions,
        explorerResolutions,
        grapherChecksumsMap,
        multiDimChecksumsMap,
        explorerChecksumsMap,
        narrativeChartChecksumsMap,
        variableChecksumsMap
    )

    const checksums: PostChecksums = {
        postContentMd5: post.contentMd5,
        indicators: postIndicators,
        graphers,
        explorers,
        multiDims,
        narrativeCharts,
        images: _.mapValues(_.keyBy(images, "id"), (image) => ({
            filename: image.filename,
            hash: image.hash,
        })),
    }

    return {
        postId: post.id,
        postSlug: post.slug,
        checksums,
        checksumsHashed: hashPostChecksumsObj(checksums),
    }
}

function collectPostIndicators(
    postCharts: ChartsByPost,
    grapherResolutions: Map<string, ResolvedSlug>,
    explorerResolutions: Map<string, ResolvedSlug>,
    grapherChecksumsMap: Map<string, GrapherChecksumsObjectWithHash>,
    multiDimChecksumsMap: Map<string, MultiDimChecksumsObjectWithHash>,
    explorerChecksumsMap: Map<string, ExplorerChecksumsObjectWithHash>,
    narrativeChartChecksumsMap: Map<string, NarrativeChartChecksumsResult>,
    variableChecksumsMap: Map<
        string,
        { metadataChecksum: string; dataChecksum: string }
    >
): IndicatorChecksums {
    const postIndicators: IndicatorChecksums = {}

    function addIndicatorsFromChecksums(indicators: IndicatorChecksums): void {
        for (const id of Object.keys(indicators)) {
            const checksum = variableChecksumsMap.get(id)
            if (checksum) {
                postIndicators[id] = checksum
            }
        }
    }

    // From grapher slugs (which may resolve to graphers or multi-dims)
    for (const originalSlug of postCharts.grapher) {
        const resolved = grapherResolutions.get(originalSlug)
        if (!resolved) continue

        if (resolved.type === "grapher") {
            const checksum = grapherChecksumsMap.get(resolved.slug)
            if (checksum) {
                addIndicatorsFromChecksums(checksum.checksums.indicators)
            }
        } else if (resolved.type === "multiDim") {
            const checksum = multiDimChecksumsMap.get(resolved.slug)
            if (checksum) {
                addIndicatorsFromChecksums(checksum.checksums.indicators)
            }
        }
    }

    // From explorer slugs (which may resolve to explorers or multi-dims)
    for (const originalSlug of postCharts.explorer) {
        const resolved = explorerResolutions.get(originalSlug)
        if (!resolved) continue

        if (resolved.type === "explorer") {
            const checksum = explorerChecksumsMap.get(resolved.slug)
            if (checksum) {
                addIndicatorsFromChecksums(checksum.checksums.indicators)
            }
        } else if (resolved.type === "multiDim") {
            const checksum = multiDimChecksumsMap.get(resolved.slug)
            if (checksum) {
                addIndicatorsFromChecksums(checksum.checksums.indicators)
            }
        }
    }

    // From narrative charts
    for (const name of postCharts.narrativeChart) {
        const checksum = narrativeChartChecksumsMap.get(name)
        if (checksum) {
            addIndicatorsFromChecksums(checksum.checksums.indicators)
        }
    }

    return postIndicators
}

export async function findChangedPostPages(
    knex: db.KnexReadonlyTransaction
): Promise<{
    postChecksums: PostChecksumsObjectWithHash[]
    imagesByPostId: Record<string, ArchivalImage[]>
    videosByPostId: Record<string, string[]>
}> {
    const { postChecksums: allPostChecksums, imagesByPostId } =
        await getPostChecksumsFromDb(knex)

    // We're gonna find the hashes of all the posts that are already archived and up-to-date
    const postIds = allPostChecksums.map((c) => c.postId)
    const hashesFoundInDb =
        postIds.length > 0
            ? await getLatestArchivedPostVersionHashes(knex, postIds)
            : new Map<string, string>()
    const [alreadyArchived, needToBeArchived] = _.partition(
        allPostChecksums,
        (c) => hashesFoundInDb.get(c.postId) === c.checksumsHashed
    )

    console.log("total published articles", allPostChecksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    const postIdsToArchive = _.uniq(needToBeArchived.map((post) => post.postId))
    const imagesByPostIdToArchive = _.pick(imagesByPostId, postIdsToArchive)
    const videosByPostIdToArchive = await getVideosByPostId(
        knex,
        postIdsToArchive
    )

    return {
        postChecksums: needToBeArchived,
        imagesByPostId: imagesByPostIdToArchive,
        videosByPostId: videosByPostIdToArchive,
    }
}
