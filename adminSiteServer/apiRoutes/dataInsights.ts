import e from "express"
import { Request } from "../authentication.js"
import {
    DbPlainNarrativeChart,
    DbRawChartConfig,
    DbRawImage,
    DbRawPostGdoc,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    GrapherChartOrMapType,
    GrapherInterface,
    MinimalTag,
    OwidGdocDataInsightContent,
    OwidGdocDataInsightIndexItem,
    parseChartConfig,
    parsePostGdocContent,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import {
    createOrLoadGdocById,
    getTagsGroupedByGdocId,
} from "../../db/model/Gdoc/GdocFactory.js"
import {
    createGdocFromTemplate,
    replacePlaceholdersInGdoc,
} from "../../db/model/Gdoc/archieToGdoc.js"
import { GDOCS_DATA_INSIGHT_API_TEMPLATE_ID } from "../../settings/clientSettings.js"
import { GrapherState } from "@ourworldindata/grapher"

const GRAPHER_URL_PREFIX = "https://ourworldindata.org/grapher/"
const EXPLORER_URL_PREFIX = "https://ourworldindata.org/explorers/"

type DataInsightRow = Pick<
    DbRawPostGdoc,
    "slug" | "content" | "published" | "publishedAt" | "markdown"
> &
    Pick<DbRawImage, "cloudflareId" | "filename" | "originalWidth"> & {
        gdocId: DbRawPostGdoc["id"]
        narrativeChartId?: DbPlainNarrativeChart["id"]
        narrativeChartConfigId?: DbPlainNarrativeChart["chartConfigId"]
        chartConfig?: DbRawChartConfig["full"]
        imageId?: DbRawImage["id"]
        tags?: MinimalTag[]
    }

export async function getAllDataInsightIndexItems(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return getAllDataInsightIndexItemsOrderedByUpdatedAt(trx)
}

export async function createDataInsightGDoc(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    // Find the user's data insight folder
    const targetFolder = res.locals.user.dataInsightFolderId
    if (!targetFolder) {
        throw new Error(
            `Data insight folder doesn't exist for ${res.locals.user.fullName}`
        )
    }

    // Create a new GDoc from the template
    const docTitle = req.body.title ?? "Untitled Data Insight"
    const gdocId = await createGdocFromTemplate(
        GDOCS_DATA_INSIGHT_API_TEMPLATE_ID,
        docTitle,
        targetFolder
    )

    // Insert given information into the GDoc
    const previewLink = `https://admin.owid.io/admin/gdocs/${gdocId}/preview`
    const replacements = {
        title: req.body.title ?? "",
        authors: req.body.authors ?? "",
        "grapher-url": req.body.grapherUrl ?? "",
        "narrative-chart": req.body.narrativeChart ?? "",
        "figma-url": req.body.figmaUrl ?? "",
        filename: req.body.filename ?? "",
        "preview-link": previewLink,
    }
    await replacePlaceholdersInGdoc(gdocId, replacements)

    // Load the GDoc into the database
    await createOrLoadGdocById(trx, gdocId)

    return { success: true, gdocId }
}

async function getAllDataInsightIndexItemsOrderedByUpdatedAt(
    knex: db.KnexReadonlyTransaction
): Promise<OwidGdocDataInsightIndexItem[]> {
    const rows = await db.knexRaw<DataInsightRow>(
        knex,
        `-- sql

        -- only consider published stand-alone charts since we join by slug which is only unique for published charts
        WITH published_charts AS (
            SELECT cc.id, cc.slug, cc.full
            FROM chart_configs cc
            JOIN charts c ON c.configId = cc.id
            WHERE cc.full ->> '$.isPublished' = 'true'
        )

        SELECT
            -- gdoc fields
            pg.id AS gdocId,
            pg.slug,
            pg.content,
            pg.published,
            pg.publishedAt,
            pg.markdown,

            -- narrative chart fields
            nc.id AS narrativeChartId,
            nc.chartConfigId AS narrativeChartConfigId,

            -- chart config (prefer narrative charts over grapher URLs)
            COALESCE(cc_narrativeChart.full, cc_grapherUrl.full) AS chartConfig,

            -- image fields
            i.id AS imageId,
            i.filename,
            i.cloudflareId,
            i.originalWidth
        FROM posts_gdocs pg

        -- extract the slug from the given Grapher URL and join by it
        LEFT JOIN published_charts cc_grapherUrl
            ON cc_grapherUrl.slug = SUBSTRING_INDEX(SUBSTRING_INDEX(content ->> '$."grapher-url"', '/grapher/', -1), '\\?', 1)

        -- join the narrative_charts table to get the config of the narrative chart
        LEFT JOIN narrative_charts nc
            ON nc.name = content ->> '$."narrative-chart"'
        LEFT JOIN chart_configs cc_narrativeChart
            ON cc_narrativeChart.id = nc.chartConfigId

        -- join the images table by filename (only works for data insights where the image block comes first)
        LEFT JOIN images i
            ON i.filename = COALESCE(pg.content ->> '$.body[0].smallFilename', pg.content ->> '$.body[0].filename')

        WHERE
            pg.type = 'data-insight'
            AND i.replacedBy IS NULL

        ORDER BY pg.updatedAt DESC`
    )
    const groupedTags = await getTagsGroupedByGdocId(
        knex,
        rows.map((row) => row.gdocId)
    )
    return rows.map((row) =>
        extractDataInsightIndexItem({
            ...row,
            tags: groupedTags[row.gdocId] ? groupedTags[row.gdocId] : undefined,
        })
    )
}

function extractDataInsightIndexItem(
    dataInsight: DataInsightRow
): OwidGdocDataInsightIndexItem {
    const content = parsePostGdocContent(
        dataInsight.content
    ) as OwidGdocDataInsightContent
    const chartConfig = dataInsight.chartConfig
        ? parseChartConfig(dataInsight.chartConfig)
        : undefined

    // check if the given grapher-url is a valid Grapher or Explorer URL
    const grapherUrlField = content["grapher-url"]
    const grapherUrl = grapherUrlField?.startsWith(GRAPHER_URL_PREFIX)
        ? grapherUrlField
        : undefined
    const explorerUrl = grapherUrlField?.startsWith(EXPLORER_URL_PREFIX)
        ? grapherUrlField
        : undefined

    // collect narrative chart data if it exists
    const narrativeChart =
        content["narrative-chart"] && dataInsight.narrativeChartId
            ? {
                  id: dataInsight.narrativeChartId,
                  name: content["narrative-chart"],
                  chartConfigId: dataInsight.narrativeChartConfigId!,
              }
            : undefined

    // detect the chart type from the narrative chart or grapher URL
    const chartType = detectChartType({
        narrativeChart: narrativeChart?.name,
        grapherUrl,
        chartConfig,
    })

    // collect the image data if it exists
    const image =
        dataInsight.imageId &&
        dataInsight.cloudflareId &&
        dataInsight.originalWidth
            ? {
                  id: dataInsight.imageId,
                  filename: dataInsight.filename,
                  cloudflareId: dataInsight.cloudflareId,
                  originalWidth: dataInsight.originalWidth,
              }
            : undefined

    return {
        id: dataInsight.gdocId,
        slug: dataInsight.slug,
        tags: dataInsight.tags ?? [],
        published: !!dataInsight.published,
        publishedAt: dataInsight.publishedAt,
        markdown: dataInsight.markdown,
        title: content.title ?? "",
        authors: content.authors,
        approvedBy: content["approved-by"],
        narrativeChart,
        grapherUrl,
        explorerUrl,
        figmaUrl: content["figma-url"],
        chartType,
        image,
    }
}

function detectChartType({
    narrativeChart,
    grapherUrl,
    chartConfig,
}: {
    narrativeChart?: string
    grapherUrl?: string
    chartConfig?: GrapherInterface
}): GrapherChartOrMapType | undefined {
    if (!chartConfig) return undefined

    if (narrativeChart) return getChartTypeFromConfig(chartConfig)

    if (grapherUrl) {
        const url = new URL(grapherUrl)
        return getChartTypeFromConfigAndQueryParams(
            chartConfig,
            url.searchParams
        )
    }

    return undefined
}

export function getChartTypeFromConfig(
    chartConfig: GrapherInterface
): GrapherChartOrMapType | undefined {
    return getChartTypeFromConfigAndQueryParams(chartConfig)
}

export function getChartTypeFromConfigAndQueryParams(
    chartConfig: GrapherInterface,
    queryParams?: URLSearchParams
): GrapherChartOrMapType | undefined {
    const queryStr = queryParams?.toString()
    const grapherState = new GrapherState({ ...chartConfig, queryStr })

    if (grapherState.activeChartType) return grapherState.activeChartType

    if (grapherState.activeTab === GRAPHER_TAB_NAMES.WorldMap)
        return GRAPHER_MAP_TYPE

    return undefined
}
