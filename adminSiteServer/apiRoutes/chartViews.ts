import {
    defaultGrapherConfig,
    grapherConfigToQueryParams,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    CHART_VIEW_PROPS_TO_OMIT,
    CHART_VIEW_PROPS_TO_PERSIST,
    DbPlainChartView,
    JsonString,
    JsonError,
    parseChartConfig,
    DbInsertChartView,
    ChartViewsTableName,
    ChartConfigsTableName,
    OwidGdocLinkType,
    DbPlainUser,
    DbRawPostGdoc,
    DbRawImage,
    OwidGdocDataInsightContent,
} from "@ourworldindata/types"
import {
    diffGrapherConfigs,
    mergeGrapherConfigs,
    uniqBy,
} from "@ourworldindata/utils"
import { omit, pick } from "lodash-es"
import {
    ApiChartViewOverview,
    DataInsightMinimalInformation,
} from "../../adminShared/AdminTypes.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import {
    saveNewChartConfigInDbAndR2,
    updateChartConfigInDbAndR2,
} from "../chartConfigHelpers.js"
import { deleteGrapherConfigFromR2ByUUID } from "../chartConfigR2Helpers.js"

import * as db from "../../db/db.js"
import { expectChartById } from "./charts.js"
import { Request } from "../authentication.js"
import e from "express"
import { getPublishedLinksTo } from "../../db/model/Link.js"
import { Knex } from "knex"
import { triggerStaticBuild } from "./routeUtils.js"

const createPatchConfigAndQueryParamsForChartView = async (
    knex: db.KnexReadonlyTransaction,
    parentChartId: number,
    config: GrapherInterface
) => {
    const parentChartConfig = await expectChartById(knex, parentChartId)

    config = omit(config, CHART_VIEW_PROPS_TO_OMIT)

    const patchToParentChart = diffGrapherConfigs(config, parentChartConfig)

    const fullConfigIncludingDefaults = mergeGrapherConfigs(
        defaultGrapherConfig,
        config
    )
    const patchConfigToSave = {
        ...patchToParentChart,

        // We want to make sure we're explicitly persisting some props like entity selection
        // always, so they never change when the parent chart changes.
        // For this, we need to ensure we include the default layer, so that we even
        // persist these props when they are the same as the default.
        ...pick(fullConfigIncludingDefaults, CHART_VIEW_PROPS_TO_PERSIST),
    }

    const queryParams = grapherConfigToQueryParams(patchConfigToSave)

    const fullConfig = mergeGrapherConfigs(parentChartConfig, patchConfigToSave)
    return { patchConfig: patchConfigToSave, fullConfig, queryParams }
}

export async function getChartViews(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    type ChartViewRow = Pick<DbPlainChartView, "id" | "name" | "updatedAt"> & {
        lastEditedByUser: string
        chartConfigId: string
        title: string
        parentChartId: number
        parentTitle: string
    }

    const rows: ChartViewRow[] = await db.knexRaw(
        trx,
        `-- sql
        SELECT
            cv.id,
            cv.name,
            cv.updatedAt,
            u.fullName as lastEditedByUser,
            cv.chartConfigId,
            cc.full ->> "$.title" as title,
            cv.parentChartId,
            pcc.full ->> "$.title" as parentTitle
        FROM chart_views cv
        JOIN chart_configs cc ON cv.chartConfigId = cc.id
        JOIN charts pc ON cv.parentChartId = pc.id
        JOIN chart_configs pcc ON pc.configId = pcc.id
        JOIN users u ON cv.lastEditedByUserId = u.id
        ORDER BY cv.updatedAt DESC
        `
    )

    const chartViews: ApiChartViewOverview[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        updatedAt: row.updatedAt?.toISOString() ?? null,
        lastEditedByUser: row.lastEditedByUser,
        chartConfigId: row.chartConfigId,
        title: row.title,
        parent: {
            id: row.parentChartId,
            title: row.parentTitle,
        },
    }))

    return { chartViews }
}

export async function getChartViewById(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const id = expectInt(req.params.id)

    type ChartViewRow = Pick<DbPlainChartView, "id" | "name" | "updatedAt"> & {
        lastEditedByUser: string
        chartConfigId: string
        configFull: JsonString
        configPatch: JsonString
        parentChartId: number
        parentConfigFull: JsonString
        queryParamsForParentChart: JsonString
    }

    const row = await db.knexRawFirst<ChartViewRow>(
        trx,
        `-- sql
        SELECT
            cv.id,
            cv.name,
            cv.updatedAt,
            u.fullName as lastEditedByUser,
            cv.chartConfigId,
            cc.full as configFull,
            cc.patch as configPatch,
            cv.parentChartId,
            pcc.full as parentConfigFull,
            cv.queryParamsForParentChart
        FROM chart_views cv
        JOIN chart_configs cc ON cv.chartConfigId = cc.id
        JOIN charts pc ON cv.parentChartId = pc.id
        JOIN chart_configs pcc ON pc.configId = pcc.id
        JOIN users u ON cv.lastEditedByUserId = u.id
        WHERE cv.id = ?
        `,
        [id]
    )

    if (!row) {
        throw new JsonError(`No chart view found for id ${id}`, 404)
    }

    const chartView = {
        ...row,
        configFull: parseChartConfig(row.configFull),
        configPatch: parseChartConfig(row.configPatch),
        parentConfigFull: parseChartConfig(row.parentConfigFull),
        queryParamsForParentChart: JSON.parse(row.queryParamsForParentChart),
    }

    return chartView
}

export async function createChartView(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { name, parentChartId } = req.body as Pick<
        DbPlainChartView,
        "name" | "parentChartId"
    >
    const rawConfig = req.body.config as GrapherInterface
    if (!name || !parentChartId || !rawConfig) {
        throw new JsonError("Invalid request", 400)
    }

    const chartViewWithName = await trx
        .table(ChartViewsTableName)
        .where({ name })
        .first()

    if (chartViewWithName) {
        return {
            success: false,
            errorMsg: `Narrative chart with name "${name}" already exists`,
        }
    }

    const { patchConfig, fullConfig, queryParams } =
        await createPatchConfigAndQueryParamsForChartView(
            trx,
            parentChartId,
            rawConfig
        )

    const { chartConfigId } = await saveNewChartConfigInDbAndR2(
        trx,
        undefined,
        patchConfig,
        fullConfig
    )
    // insert into chart_views
    const insertRow: DbInsertChartView = {
        name,
        parentChartId,
        lastEditedByUserId: res.locals.user.id,
        chartConfigId: chartConfigId,
        queryParamsForParentChart: JSON.stringify(queryParams),
    }
    const result = await trx.table(ChartViewsTableName).insert(insertRow)
    const [resultId] = result

    return { chartViewId: resultId, success: true }
}

export async function updateChartView(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)
    const user: DbPlainUser = res.locals.user
    const rawConfig = req.body.config as GrapherInterface
    if (!rawConfig) {
        throw new JsonError("Invalid request", 400)
    }

    const existingRow = await trx<DbPlainChartView>(ChartViewsTableName)
        .select("parentChartId", "chartConfigId", "name")
        .where({ id })
        .first()

    if (!existingRow) {
        throw new JsonError(`No chart view found for id ${id}`, 404)
    }

    const { patchConfig, fullConfig, queryParams } =
        await createPatchConfigAndQueryParamsForChartView(
            trx,
            existingRow.parentChartId,
            rawConfig
        )

    await updateChartConfigInDbAndR2(
        trx,
        existingRow.chartConfigId,
        patchConfig,
        fullConfig
    )

    await trx
        .table(ChartViewsTableName)
        .where({ id })
        .update({
            updatedAt: new Date(),
            lastEditedByUserId: user.id,
            queryParamsForParentChart: JSON.stringify(queryParams),
        })

    const references = await getPublishedLinksTo(
        trx,
        [existingRow.name],
        OwidGdocLinkType.ChartView
    )
    if (references.length > 0) {
        await triggerStaticBuild(
            user,
            `Updating narrative chart ${existingRow.name}`
        )
    }

    return { success: true }
}

export async function deleteChartView(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)

    const {
        name,
        chartConfigId,
    }: { name: string | undefined; chartConfigId: string | undefined } =
        await trx(ChartViewsTableName)
            .select("name", "chartConfigId")
            .where({ id })
            .first()
            .then((row) => row ?? {})

    if (!chartConfigId || !name) {
        throw new JsonError(`No chart view found for id ${id}`, 404)
    }

    const references = await getPublishedLinksTo(
        trx,
        [name],
        OwidGdocLinkType.ChartView
    )

    if (references.length) {
        throw new JsonError(
            `Cannot delete chart view "${name}" because it is referenced by the following posts: ${references
                .map((r) => r.slug)
                .join(", ")}`,
            400
        )
    }

    await trx.table(ChartViewsTableName).where({ id }).delete()

    await deleteGrapherConfigFromR2ByUUID(chartConfigId)

    await trx.table(ChartConfigsTableName).where({ id: chartConfigId }).delete()

    return { success: true }
}

export async function getChartViewReferences(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const id = expectInt(req.params.id)
    const name: string | undefined = await trx(ChartViewsTableName)
        .select("name")
        .where({ id })
        .first()
        .then((row) => row?.name)

    if (!name) {
        throw new JsonError(`No chart view found for id ${id}`, 404)
    }

    const postsGdocs = await getPublishedLinksTo(
        trx,
        [name],
        OwidGdocLinkType.ChartView
    ).then((refs) => uniqBy(refs, "slug"))

    const dataInsights = await getDataInsightsForChartView(trx, id)

    return { references: { postsGdocs, dataInsights } }
}

async function getDataInsightsForChartView(
    knex: Knex<any, any[]>,
    chartViewId: number
): Promise<DataInsightMinimalInformation[]> {
    const rows = await db.knexRaw<
        Pick<DbRawPostGdoc, "id" | "published"> &
            Pick<OwidGdocDataInsightContent, "title"> & {
                figmaUrl: OwidGdocDataInsightContent["figma-url"]
                imageId: DbRawImage["id"]
                imageFilename: DbRawImage["filename"]
                imageCloudflareId: DbRawImage["cloudflareId"]
                imageOriginalWidth: DbRawImage["originalWidth"]
            }
    >(
        knex,
        `-- sql
        SELECT
            pg.id,
            pg.published,
            pg.content ->> '$.title' as title,
            pg.content ->> '$."figma-url"' as figmaUrl,
            i.id As imageId,
            i.filename AS imageFilename,
            i.cloudflareId AS imageCloudflareId,
            i.originalWidth AS imageOriginalWidth
        FROM posts_gdocs pg
        LEFT JOIN chart_views cw
            ON cw.name = content ->> '$."narrative-chart"'
        LEFT JOIN chart_configs cc
            ON cc.id = cw.chartConfigId
        -- only works if the image block comes first
        LEFT JOIN images i
            ON i.filename = COALESCE(pg.content ->> '$.body[0].smallFilename', pg.content ->> '$.body[0].filename')
        WHERE
            pg.type = 'data-insight'
            AND i.replacedBy IS NULL
            AND cw.id = ?
        `,
        [chartViewId]
    )

    return rows.map((row) => ({
        gdocId: row.id,
        title: row.title ?? "",
        published: !!row.published,
        figmaUrl: row.figmaUrl,
        image:
            row.imageId && row.imageCloudflareId && row.imageOriginalWidth
                ? {
                      id: row.imageId,
                      filename: row.imageFilename,
                      cloudflareId: row.imageCloudflareId,
                      originalWidth: row.imageOriginalWidth,
                  }
                : undefined,
    }))
}
