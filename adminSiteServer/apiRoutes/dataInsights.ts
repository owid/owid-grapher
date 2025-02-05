import e from "express"
import { Request } from "../authentication.js"
import {
    DbPlainChartView,
    DbRawChartConfig,
    DbRawImage,
    DbRawPostGdoc,
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
    getChartTypeFromConfig,
    getChartTypeFromConfigAndQueryParams,
} from "@ourworldindata/grapher"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { google } from "googleapis"

const GRAPHER_URL_PREFIX = "https://ourworldindata.org/grapher/"
const EXPLORER_URL_PREFIX = "https://ourworldindata.org/explorers/"

type DataInsightRow = Pick<
    DbRawPostGdoc,
    "slug" | "content" | "published" | "publishedAt" | "markdown"
> &
    Pick<DbRawImage, "cloudflareId" | "filename" | "originalWidth"> & {
        gdocId: DbRawPostGdoc["id"]
        narrativeChartId?: DbPlainChartView["id"]
        narrativeChartConfigId?: DbPlainChartView["chartConfigId"]
        chartConfig?: DbRawChartConfig["full"]
        imageId?: DbRawImage["id"]
        tags?: MinimalTag[]
    }

export async function getAllDataInsightIndexItems(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return getAllDataInsightIndexItemsOrderedByUpdatedAt(trx)
}

async function createGDocFromTemplate(
    templateId: string,
    title: string,
    folderId?: string
): Promise<string> {
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const driveClient = google.drive({ version: "v3", auth })

    const docsMimeType = "application/vnd.google-apps.document"
    const response = await driveClient.files.copy({
        supportsAllDrives: true,
        fileId: templateId,
        requestBody: {
            name: title,
            parents: folderId ? [folderId] : undefined,
            mimeType: docsMimeType,
        },
    })

    if (!response.data.id) {
        throw new Error("Failed to copy document")
    }

    console.log(
        `Copied document: https://docs.google.com/document/d/${response.data.id}`
    )
    return response.data.id
}

async function replacePlaceholdersInGdoc(
    docId: string,
    replacements: Record<string, string>
) {
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const client = google.docs({ version: "v1", auth })

    const requests = Object.entries(replacements).map(
        ([placeholder, value]) => ({
            replaceAllText: {
                containsText: {
                    text: `{{${placeholder}}}`, // Match placeholders like {{name}}
                    matchCase: true,
                },
                replaceText: value,
            },
        })
    )

    await client.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests },
    })
}

export async function createDataInsightGDoc(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    // const TEST_TEMPLATE_ID = "1yKzQCEyqgVsHtoa885I0MTzHZP6-WSns-HbMaSQ2ceA"
    // const TEST_TEMPLATE_ID = "10HjGEmhcv0mEWkbl4IN85OWJT9Lf4Z37wWg3CExhHy8"
    // const TEST_FOLDER_ID = "1FkROLdqrkUcOEacHUDQ1ucgBpy0BZWVB"

    // const gdocId = await createGDocFromTemplate(
    //     TEST_TEMPLATE_ID,
    //     "Sophia Test (today)",
    //     TEST_FOLDER_ID
    // )
    const gdocId = "1-aYmclBHSzCIjqdROJHFdLYm0BX3dO40TcCgSlRuSEo"

    const replacements = {
        title: req.body.title ?? "",
        authors: req.body.authors ?? "",
        "narrative-chart": req.body.narrativeChart ?? "",
        "figma-url": req.body.figmaUrl ?? "",
        filename: req.body.filename ?? "",
    }
    await replacePlaceholdersInGdoc(gdocId, replacements)

    const result = await createOrLoadGdocById(trx, gdocId)

    return {
        success: true,
        gdocId,
        result,
    }
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
            cw.id AS narrativeChartId,
            cw.chartConfigId AS narrativeChartConfigId,

            -- chart config (prefer narrative charts over grapher URLs)
            COALESCE(cc_chartView.full, cc_grapherUrl.full) AS chartConfig,

            -- image fields
            i.id AS imageId,
            i.filename,
            i.cloudflareId,
            i.originalWidth
        FROM posts_gdocs pg

        -- extract the slug from the given Grapher URL and join by it
        LEFT JOIN published_charts cc_grapherUrl
            ON cc_grapherUrl.slug = SUBSTRING_INDEX(SUBSTRING_INDEX(content ->> '$."grapher-url"', '/grapher/', -1), '\\?', 1)

        -- join the chart_views table to get the config of the narrative chart
        LEFT JOIN chart_views cw
            ON cw.name = content ->> '$."narrative-chart"'
        LEFT JOIN chart_configs cc_chartView
            ON cc_chartView.id = cw.chartConfigId

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
