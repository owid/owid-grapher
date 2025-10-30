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
): Promise<
    {
        narrativeChartId: number
        narrativeChartName: string
        chartConfigMd5: string
        queryParamsForParentChartMd5: string
        indicators: IndicatorChecksums
    }[]
> => {
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

        return {
            narrativeChartId: chart.id,
            narrativeChartName: chart.name,
            chartConfigMd5: chart.chartConfigMd5,
            queryParamsForParentChartMd5: chart.queryParamsForParentChartMd5,
            indicators,
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

const getLinkedChartsFromPosts = async (
    knex: db.KnexReadonlyTransaction,
    postIds: string[]
): Promise<LinkedChart[]> => {
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

const groupLinkedChartsByPost = (
    posts: Pick<DbRawPostGdoc, "id">[],
    linkedCharts: LinkedChart[]
): Map<string, ChartsByPost> => {
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

export const getImagesByPostId = async (
    knex: db.KnexReadonlyTransaction,
    postIds: string[]
): Promise<Record<string, ArchivalImage[]>> => {
    const imagesByPostId: Record<string, ArchivalImage[]> = {}
    if (postIds.length === 0) return imagesByPostId

    for (const postId of postIds) {
        const gdocBase = await getGdocBaseObjectById(knex, postId, false, true)
        if (!gdocBase) continue

        // Load only what's needed for linkedImageFilenames.
        const gdoc = GdocPost.create(gdocBase)
        await gdoc.loadLinkedDocuments(knex)

        const linkedFilenames = gdoc.linkedImageFilenames
        if (linkedFilenames.length === 0) continue

        imagesByPostId[postId] = await knex<DbRawImage>(ImagesTableName)
            .select("id", "cloudflareId", "filename", "hash", "originalWidth")
            .where("replacedBy", null)
            .whereIn("filename", linkedFilenames)
    }

    return imagesByPostId
}

export const getVideosByPostId = async (
    knex: db.KnexReadonlyTransaction,
    postIds: string[]
): Promise<Record<string, string[]>> => {
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

const getVariableChecksumsForIds = async (
    knex: db.KnexReadonlyTransaction,
    variableIds: Set<number>
): Promise<Map<string, { metadataChecksum: string; dataChecksum: string }>> => {
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

const resolveGrapherRedirects = async (
    knex: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<Map<string, string>> => {
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

export const getPostChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction
): Promise<{
    postChecksums: PostChecksumsObjectWithHash[]
    imagesByPostId: Record<string, ArchivalImage[]>
}> => {
    const posts = await knex<DbRawPostGdoc>(PostsGdocsTableName)
        .select("id", "slug", "contentMd5")
        .where("published", true)
        .where("type", OwidGdocType.Article)

    if (posts.length === 0) return { postChecksums: [], imagesByPostId: {} }

    const postIds = posts.map((p) => p.id)
    const linkedCharts = await getLinkedChartsFromPosts(knex, postIds)
    const chartsByPost = groupLinkedChartsByPost(posts, linkedCharts)
    const imagesByPostId = await getImagesByPostId(knex, postIds)

    const allGrapherSlugs = new Set<string>()
    const allExplorerSlugs = new Set<string>()
    const allNarrativeChartNames = new Set<string>()
    for (const [, charts] of chartsByPost) {
        charts.grapher.forEach((slug) => allGrapherSlugs.add(slug))
        charts.explorer.forEach((slug) => allExplorerSlugs.add(slug))
        charts.narrativeChart.forEach((name) =>
            allNarrativeChartNames.add(name)
        )
    }

    const grapherSlugRedirects = await resolveGrapherRedirects(
        knex,
        Array.from(allGrapherSlugs)
    )

    // Replace original slugs with resolved slugs.
    for (const [, charts] of chartsByPost) {
        charts.grapher = new Set(
            charts.grapher
                .values()
                .map((slug) => grapherSlugRedirects.get(slug) ?? slug)
        )
    }

    const resolvedGrapherSlugs = new Set(
        chartsByPost.values().flatMap((charts) => charts.grapher)
    )

    const grapherChecksums = await getGrapherChecksumsFromDb(
        knex,
        Array.from(resolvedGrapherSlugs)
    )
    const grapherChecksumsMap = new Map(
        grapherChecksums.map((c) => [c.chartSlug, c])
    )

    const multiDimSlugs = Array.from(resolvedGrapherSlugs).filter(
        (slug) => !grapherChecksumsMap.has(slug)
    )
    const multiDimChecksums = await getMultiDimChecksumsFromDb(
        knex,
        multiDimSlugs
    )
    const multiDimChecksumsMap = new Map(
        multiDimChecksums.map((m) => [m.multiDimSlug, m])
    )

    const explorerChecksums = await getExplorerChecksumsFromDb(
        knex,
        Array.from(allExplorerSlugs)
    )
    const explorerChecksumsMap = new Map(
        explorerChecksums.map((e) => [e.explorerSlug, e])
    )

    const narrativeChartChecksums = await getNarrativeChartChecksumsFromDb(
        knex,
        Array.from(allNarrativeChartNames)
    )
    const narrativeChartChecksumsMap = new Map(
        narrativeChartChecksums.map((nc) => [nc.narrativeChartName, nc])
    )

    const allVariableIds = new Set<number>()
    for (const grapher of grapherChecksums) {
        Object.keys(grapher.checksums.indicators).forEach((id) =>
            allVariableIds.add(parseInt(id))
        )
    }
    for (const multiDim of multiDimChecksums) {
        Object.keys(multiDim.checksums.indicators).forEach((id) =>
            allVariableIds.add(parseInt(id))
        )
    }
    for (const explorer of explorerChecksums) {
        Object.keys(explorer.checksums.indicators).forEach((id) =>
            allVariableIds.add(parseInt(id))
        )
    }
    for (const narrativeChart of narrativeChartChecksums) {
        Object.keys(narrativeChart.indicators).forEach((id) =>
            allVariableIds.add(parseInt(id))
        )
    }

    const variableChecksumsMap = await getVariableChecksumsForIds(
        knex,
        allVariableIds
    )

    const postChecksums = posts.map((post) => {
        const postCharts = chartsByPost.get(post.id)!

        const graphers: Record<
            string,
            { slug: string; chartConfigMd5: string }
        > = {}
        for (const slug of postCharts.grapher) {
            const checksum = grapherChecksumsMap.get(slug)
            if (checksum) {
                graphers[checksum.chartId.toString()] = {
                    slug: checksum.chartSlug,
                    chartConfigMd5: checksum.checksums.chartConfigMd5,
                }
            }
        }

        const multiDims: Record<
            string,
            {
                slug: string
                multiDimConfigMd5: string
                chartConfigs: Record<string, string>
            }
        > = {}
        for (const slug of postCharts.grapher) {
            const checksum = multiDimChecksumsMap.get(slug)
            if (checksum) {
                multiDims[checksum.multiDimId.toString()] = {
                    slug: checksum.multiDimSlug,
                    multiDimConfigMd5: checksum.checksums.multiDimConfigMd5,
                    chartConfigs: checksum.checksums.chartConfigs,
                }
            }
        }

        const explorers: Record<
            string,
            {
                explorerConfigMd5: string
                chartConfigs: Record<string, string>
            }
        > = {}
        for (const slug of postCharts.explorer) {
            const checksum = explorerChecksumsMap.get(slug)
            if (checksum) {
                explorers[slug] = {
                    explorerConfigMd5: checksum.checksums.explorerConfigMd5,
                    chartConfigs: checksum.checksums.chartConfigs,
                }
            }
        }

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
                    chartConfigMd5: checksum.chartConfigMd5,
                    queryParamsForParentChartMd5:
                        checksum.queryParamsForParentChartMd5,
                }
            }
        }

        const postIndicators: Record<
            string,
            { metadataChecksum: string; dataChecksum: string }
        > = {}
        for (const slug of postCharts.grapher) {
            const grapherChecksum = grapherChecksumsMap.get(slug)
            if (grapherChecksum) {
                for (const id of Object.keys(
                    grapherChecksum.checksums.indicators
                )) {
                    const variableChecksum = variableChecksumsMap.get(id)
                    if (variableChecksum) {
                        postIndicators[id] = variableChecksum
                    }
                }
            }
            const multiDimChecksum = multiDimChecksumsMap.get(slug)
            if (multiDimChecksum) {
                for (const id of Object.keys(
                    multiDimChecksum.checksums.indicators
                )) {
                    const variableChecksum = variableChecksumsMap.get(id)
                    if (variableChecksum) {
                        postIndicators[id] = variableChecksum
                    }
                }
            }
        }
        for (const slug of postCharts.explorer) {
            const explorerChecksum = explorerChecksumsMap.get(slug)
            if (explorerChecksum) {
                for (const id of Object.keys(
                    explorerChecksum.checksums.indicators
                )) {
                    const variableChecksum = variableChecksumsMap.get(id)
                    if (variableChecksum) {
                        postIndicators[id] = variableChecksum
                    }
                }
            }
        }
        for (const name of postCharts.narrativeChart) {
            const narrativeChartChecksum = narrativeChartChecksumsMap.get(name)
            if (narrativeChartChecksum) {
                for (const id of Object.keys(
                    narrativeChartChecksum.indicators
                )) {
                    const variableChecksum = variableChecksumsMap.get(id)
                    if (variableChecksum) {
                        postIndicators[id] = variableChecksum
                    }
                }
            }
        }

        const checksums: PostChecksums = {
            postContentMd5: post.contentMd5,
            indicators: postIndicators,
            graphers,
            explorers,
            multiDims,
            narrativeCharts,
            images: _.mapValues(
                _.keyBy(imagesByPostId[post.id], "id"),
                (image) => ({
                    filename: image.filename,
                    hash: image.hash,
                })
            ),
        }

        return {
            postId: post.id,
            postSlug: post.slug,
            checksums,
            checksumsHashed: hashPostChecksumsObj(checksums),
        }
    })

    return {
        postChecksums,
        imagesByPostId,
    }
}

export const findChangedPostPages = async (
    knex: db.KnexReadonlyTransaction
): Promise<{
    postChecksums: PostChecksumsObjectWithHash[]
    imagesByPostId: Record<string, ArchivalImage[]>
    videosByPostId: Record<string, string[]>
}> => {
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
