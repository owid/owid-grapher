import * as _ from "lodash-es"
import {
    defaultGrapherConfig,
    grapherConfigToQueryParams,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    NARRATIVE_CHART_PROPS_TO_OMIT,
    NARRATIVE_CHART_PROPS_TO_PERSIST,
    DbPlainNarrativeChart,
    JsonString,
    JsonError,
    parseChartConfig,
    DbInsertNarrativeChart,
    NarrativeChartsTableName,
    ChartConfigsTableName,
    DbPlainUser,
    DbRawPostGdoc,
    DbRawImage,
    OwidGdocDataInsightContent,
    ContentGraphLinkType,
    DbPlainMultiDimXChartConfig,
    MultiDimXChartConfigsTableName,
    DbInsertChartConfig,
} from "@ourworldindata/types"
import { diffGrapherConfigs, mergeGrapherConfigs } from "@ourworldindata/utils"
import { z } from "zod"
import {
    ApiNarrativeChartOverview,
    DataInsightMinimalInformation,
} from "../../adminShared/AdminTypes.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import {
    saveNewChartConfigInDbAndR2,
    updateChartConfigInDbAndR2,
} from "../chartConfigHelpers.js"
import { deleteGrapherConfigFromR2ByUUID } from "../R2/chartConfigR2Helpers.js"

import {
    isKebabCase,
    NARRATIVE_CHART_KEBAB_CASE_ERROR_MSG,
} from "../../adminShared/validation.js"
import * as db from "../../db/db.js"
import { expectChartById } from "./charts.js"
import { Request } from "../authentication.js"
import e from "express"
import { getPublishedLinksTo } from "../../db/model/Link.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import { getChartConfigById as _getChartConfigById } from "../../db/model/ChartConfigs.js"
import { narrativeChartExists } from "../../db/model/NarrativeChart.js"
import { getMultiDimDataPageById } from "../../db/model/MultiDimDataPage.js"

const createPatchConfigAndQueryParamsForNarrativeChart = async (
    parentChartConfig: GrapherInterface,
    config: GrapherInterface
) => {
    config = _.omit(config, NARRATIVE_CHART_PROPS_TO_OMIT)

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
        ..._.pick(
            fullConfigIncludingDefaults,
            NARRATIVE_CHART_PROPS_TO_PERSIST
        ),
    }

    const queryParams = grapherConfigToQueryParams(patchConfigToSave)

    const fullConfig = mergeGrapherConfigs(parentChartConfig, patchConfigToSave)
    return { patchConfig: patchConfigToSave, fullConfig, queryParams }
}

function makeParentUrl(
    parentChartId: number | null,
    parentCatalogPath: string | null,
    queryParamsForParentChart: string
) {
    if (parentChartId) {
        return `/charts/${parentChartId}/edit`
    }
    if (parentCatalogPath) {
        const searchParams = new URLSearchParams(
            JSON.parse(queryParamsForParentChart)
        )
        return `/grapher/${encodeURIComponent(parentCatalogPath)}?${searchParams.toString()}`
    }
    return null
}

async function getChartConfigById(
    trx: db.KnexReadonlyTransaction,
    chartConfigId: string
) {
    const chartConfig = await _getChartConfigById(trx, chartConfigId)
    if (!chartConfig) {
        throw new JsonError(
            `No chart config found for id ${chartConfigId}`,
            404
        )
    }
    return chartConfig
}

async function getChartConfigByMultiDimXChartConfigId(
    trx: db.KnexReadonlyTransaction,
    multiDimXChartConfigId: number
) {
    const row = await trx<DbInsertChartConfig>(ChartConfigsTableName)
        .select("full")
        .join(
            MultiDimXChartConfigsTableName,
            `${ChartConfigsTableName}.id`,
            `${MultiDimXChartConfigsTableName}.chartConfigId`
        )
        .where(`${MultiDimXChartConfigsTableName}.id`, multiDimXChartConfigId)
        .first()
    if (!row) {
        throw new JsonError(
            `No chart config found for multiDimXChartConfigId ${multiDimXChartConfigId}`,
            404
        )
    }
    return parseChartConfig(row.full)
}

async function getViewDimensions(
    trx: db.KnexReadonlyTransaction,
    multiDimXChartConfigId: number
) {
    const multiDimXChartConfig = await trx<DbPlainMultiDimXChartConfig>(
        MultiDimXChartConfigsTableName
    )
        .select("multiDimId", "chartConfigId")
        .where({ id: multiDimXChartConfigId })
        .first()
    if (!multiDimXChartConfig) {
        throw new JsonError(
            `No multi-dim x chart config found for id ${multiDimXChartConfigId}`,
            404
        )
    }
    const { multiDimId, chartConfigId } = multiDimXChartConfig
    const multiDim = await getMultiDimDataPageById(trx, multiDimId)
    if (!multiDim) {
        throw new JsonError(
            `No multi-dim data page found for id ${multiDimId}`,
            404
        )
    }
    const view = multiDim.config.views.find(
        (v) => v.fullConfigId === chartConfigId
    )
    if (!view) {
        throw new JsonError(
            `No multi-dim view found for id ${multiDimXChartConfig.chartConfigId}`,
            404
        )
    }
    return view.dimensions
}

export async function getNarrativeCharts(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    type NarrativeChartRow = Pick<
        DbPlainNarrativeChart,
        "id" | "name" | "updatedAt"
    > & {
        lastEditedByUser: string
        chartConfigId: string
        title: string
        parentChartId: number | null
        parentMultiDimXChartConfigId: number | null
        parentTitle: string
        parentCatalogPath: string | null
        queryParamsForParentChart: string
    }

    const rows: NarrativeChartRow[] = await db.knexRaw(
        trx,
        `-- sql
        SELECT
            nc.id,
            nc.name,
            nc.updatedAt,
            u.fullName as lastEditedByUser,
            nc.chartConfigId,
            cc.full ->> "$.title" as title,
            nc.parentChartId,
            nc.parentMultiDimXChartConfigId,
            nc.queryParamsForParentChart,
            CASE
                WHEN nc.parentChartId IS NOT NULL THEN pcc1.full ->> "$.title"
                ELSE COALESCE(
                    pcc2.full ->> "$.title",
                    mddp.config ->> "$.title.title",
                    ''
                )
            END as parentTitle,
            mddp.catalogPath as parentCatalogPath
        FROM narrative_charts nc
        JOIN chart_configs cc ON nc.chartConfigId = cc.id
        JOIN users u ON nc.lastEditedByUserId = u.id
        -- For chart parents
        LEFT JOIN charts pc ON nc.parentChartId = pc.id
        LEFT JOIN chart_configs pcc1 ON pc.configId = pcc1.id
        -- For multi-dim view parents
        LEFT JOIN multi_dim_x_chart_configs mdxcc ON nc.parentMultiDimXChartConfigId = mdxcc.id
        LEFT JOIN multi_dim_data_pages mddp ON mdxcc.multiDimId = mddp.id
        LEFT JOIN chart_configs pcc2 ON mdxcc.chartConfigId = pcc2.id
        ORDER BY nc.updatedAt DESC
        `
    )

    const narrativeCharts: ApiNarrativeChartOverview[] = rows.map((row) => {
        return {
            id: row.id,
            name: row.name,
            updatedAt: row.updatedAt?.toISOString() ?? null,
            lastEditedByUser: row.lastEditedByUser,
            chartConfigId: row.chartConfigId,
            title: row.title,
            parent: {
                type: row.parentChartId ? "chart" : "multiDim",
                title: row.parentTitle,
                url: makeParentUrl(
                    row.parentChartId,
                    row.parentCatalogPath,
                    row.queryParamsForParentChart
                ),
            },
        }
    })

    return { narrativeCharts }
}

export async function getNarrativeChartById(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const id = expectInt(req.params.id)

    type NarrativeChartRow = Pick<
        DbPlainNarrativeChart,
        "id" | "name" | "updatedAt"
    > & {
        lastEditedByUser: string
        chartConfigId: string
        configFull: JsonString
        configPatch: JsonString
        parentChartId: number
        parentConfigFull: JsonString
        parentCatalogPath: string | null
        queryParamsForParentChart: JsonString
    }

    const row = await db.knexRawFirst<NarrativeChartRow>(
        trx,
        `-- sql
        SELECT
            nc.id,
            nc.name,
            nc.updatedAt,
            u.fullName as lastEditedByUser,
            nc.chartConfigId,
            cc.full as configFull,
            cc.patch as configPatch,
            nc.parentChartId,
            nc.parentMultiDimXChartConfigId as parentChartConfigId,
            pcc.full as parentConfigFull,
            mddp.catalogPath as parentCatalogPath,
            nc.queryParamsForParentChart
        FROM narrative_charts nc
        JOIN chart_configs cc ON nc.chartConfigId = cc.id
        LEFT JOIN charts pc ON nc.parentChartId = pc.id
        LEFT JOIN multi_dim_x_chart_configs mdxcc ON nc.parentMultiDimXChartConfigId = mdxcc.id
        LEFT JOIN multi_dim_data_pages mddp ON mdxcc.multiDimId = mddp.id
        LEFT JOIN chart_configs pcc ON (
            CASE
                WHEN pc.id IS NOT NULL THEN pc.configId = pcc.id
                WHEN mdxcc.id IS NOT NULL THEN mdxcc.chartConfigId = pcc.id
            END
        )
        JOIN users u ON nc.lastEditedByUserId = u.id
        WHERE nc.id = ?
        `,
        [id]
    )

    if (!row) {
        throw new JsonError(`No narrative chart found for id ${id}`, 404)
    }

    return {
        id: row.id,
        name: row.name,
        updatedAt: row.updatedAt,
        lastEditedByUser: row.lastEditedByUser,
        chartConfigId: row.chartConfigId,
        configFull: parseChartConfig(row.configFull),
        configPatch: parseChartConfig(row.configPatch),
        parentType: row.parentChartId ? "chart" : "multiDim",
        parentConfigFull: parseChartConfig(row.parentConfigFull),
        parentUrl: makeParentUrl(
            row.parentChartId,
            row.parentCatalogPath,
            row.queryParamsForParentChart
        ),
    }
}

async function createNarrativeChartFromChart(
    trx: db.KnexReadWriteTransaction,
    name: string,
    parentChartId: number,
    config: GrapherInterface,
    userId: number
): Promise<
    | { narrativeChartId: number; success: boolean }
    | { success: false; errorMsg: string }
> {
    const parentConfig = await expectChartById(trx, parentChartId)
    const { patchConfig, fullConfig, queryParams } =
        await createPatchConfigAndQueryParamsForNarrativeChart(
            parentConfig,
            config
        )
    const { chartConfigId } = await saveNewChartConfigInDbAndR2(
        trx,
        undefined,
        patchConfig,
        fullConfig
    )
    const [narrativeChartId] = await trx<DbInsertNarrativeChart>(
        NarrativeChartsTableName
    ).insert({
        name,
        parentChartId,
        lastEditedByUserId: userId,
        chartConfigId,
        queryParamsForParentChart: JSON.stringify(queryParams),
    })
    return { narrativeChartId, success: true }
}

async function createNarrativeChartFromMultiDimView(
    trx: db.KnexReadWriteTransaction,
    name: string,
    parentChartConfigId: string,
    config: GrapherInterface,
    userId: number
): Promise<
    | { narrativeChartId: number; success: boolean }
    | { success: false; errorMsg: string }
> {
    const parentChartConfig = await getChartConfigById(trx, parentChartConfigId)
    const { patchConfig, fullConfig, queryParams } =
        await createPatchConfigAndQueryParamsForNarrativeChart(
            parentChartConfig.full,
            config
        )
    const multiDimXChartConfig = await trx<DbPlainMultiDimXChartConfig>(
        MultiDimXChartConfigsTableName
    )
        .select("id", "multiDimId")
        .where({ chartConfigId: parentChartConfigId })
        .first()
    if (!multiDimXChartConfig) {
        throw new JsonError(
            `No multi-dim x chart config found for id ${parentChartConfigId}`,
            404
        )
    }
    const viewDimensions = await getViewDimensions(trx, multiDimXChartConfig.id)
    const { chartConfigId } = await saveNewChartConfigInDbAndR2(
        trx,
        undefined,
        patchConfig,
        fullConfig
    )
    const [narrativeChartId] = await trx<DbInsertNarrativeChart>(
        NarrativeChartsTableName
    ).insert({
        name,
        lastEditedByUserId: userId,
        parentMultiDimXChartConfigId: multiDimXChartConfig.id,
        chartConfigId,
        queryParamsForParentChart: JSON.stringify({
            ...queryParams,
            ...viewDimensions,
        }),
    })
    return { narrativeChartId, success: true }
}

const createNarrativeChartSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("chart"),
        name: z.string(),
        parentChartId: z.number(),
        config: z.any(),
    }),
    z.object({
        type: z.literal("multiDim"),
        name: z.string(),
        parentChartConfigId: z.string(),
        config: z.any(),
    }),
])

export async function createNarrativeChart(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const parseResult = createNarrativeChartSchema.safeParse(req.body)
    if (!parseResult.success) {
        throw new JsonError(`Invalid request: ${parseResult.error}`, 400)
    }
    const { data } = parseResult
    if (!isKebabCase(data.name)) {
        return {
            success: false,
            errorMsg: NARRATIVE_CHART_KEBAB_CASE_ERROR_MSG,
        }
    }
    if (await narrativeChartExists(trx, { name: data.name })) {
        return {
            success: false,
            errorMsg: `Narrative chart with name "${data.name}" already exists`,
        }
    }
    if (data.type === "chart") {
        const { name, parentChartId, config } = data
        return createNarrativeChartFromChart(
            trx,
            name,
            parentChartId,
            config,
            res.locals.user.id
        )
    } else {
        const { name, parentChartConfigId, config } = data
        return createNarrativeChartFromMultiDimView(
            trx,
            name,
            parentChartConfigId,
            config,
            res.locals.user.id
        )
    }
}

export async function updateNarrativeChart(
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

    const existingRow = await trx<DbPlainNarrativeChart>(
        NarrativeChartsTableName
    )
        .select(
            "parentChartId",
            "parentMultiDimXChartConfigId",
            "chartConfigId",
            "name"
        )
        .where({ id })
        .first()

    if (!existingRow) {
        throw new JsonError(`No narrative chart found for id ${id}`, 404)
    }

    let parentChartConfig: GrapherInterface
    if (existingRow.parentChartId) {
        parentChartConfig = await expectChartById(
            trx,
            existingRow.parentChartId
        )
    } else if (existingRow.parentMultiDimXChartConfigId) {
        parentChartConfig = await getChartConfigByMultiDimXChartConfigId(
            trx,
            existingRow.parentMultiDimXChartConfigId
        )
    } else {
        throw new JsonError(
            `No parent chart config found for narrative chart ${id}`,
            404
        )
    }

    const { patchConfig, fullConfig, queryParams } =
        await createPatchConfigAndQueryParamsForNarrativeChart(
            parentChartConfig,
            rawConfig
        )

    let viewDimensions
    if (existingRow.parentMultiDimXChartConfigId) {
        viewDimensions = await getViewDimensions(
            trx,
            existingRow.parentMultiDimXChartConfigId
        )
    }

    await updateChartConfigInDbAndR2(
        trx,
        existingRow.chartConfigId,
        patchConfig,
        fullConfig
    )

    await trx
        .table(NarrativeChartsTableName)
        .where({ id })
        .update({
            updatedAt: new Date(),
            lastEditedByUserId: user.id,
            queryParamsForParentChart: JSON.stringify({
                ...queryParams,
                ...viewDimensions,
            }),
        })

    const references = await getPublishedLinksTo(
        trx,
        [existingRow.name],
        ContentGraphLinkType.NarrativeChart
    )
    if (references.length > 0) {
        await triggerStaticBuild(
            user,
            `Updating narrative chart ${existingRow.name}`
        )
    }

    return { success: true }
}

export async function deleteNarrativeChart(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)

    const {
        name,
        chartConfigId,
    }: { name: string | undefined; chartConfigId: string | undefined } =
        await trx(NarrativeChartsTableName)
            .select("name", "chartConfigId")
            .where({ id })
            .first()
            .then((row) => row ?? {})

    if (!chartConfigId || !name) {
        throw new JsonError(`No narrative chart found for id ${id}`, 404)
    }

    const references = await getPublishedLinksTo(
        trx,
        [name],
        ContentGraphLinkType.NarrativeChart
    )

    if (references.length) {
        throw new JsonError(
            `Cannot delete narrative chart "${name}" because it is referenced by the following posts: ${references
                .map((r) => r.slug)
                .join(", ")}`,
            400
        )
    }

    await trx.table(NarrativeChartsTableName).where({ id }).delete()

    await deleteGrapherConfigFromR2ByUUID(chartConfigId)

    await trx.table(ChartConfigsTableName).where({ id: chartConfigId }).delete()

    return { success: true }
}

export async function getNarrativeChartReferences(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const id = expectInt(req.params.id)
    const name: string | undefined = await trx(NarrativeChartsTableName)
        .select("name")
        .where({ id })
        .first()
        .then((row) => row?.name)

    if (!name) {
        throw new JsonError(`No narrative chart found for id ${id}`, 404)
    }

    const postsGdocs = await getPublishedLinksTo(
        trx,
        [name],
        ContentGraphLinkType.NarrativeChart
    ).then((refs) => _.uniqBy(refs, "slug"))

    const dataInsights = await getDataInsightsForNarrativeChart(trx, id)

    return { references: { postsGdocs, dataInsights } }
}

async function getDataInsightsForNarrativeChart(
    knex: db.KnexReadonlyTransaction,
    narrativeChartId: number
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
        LEFT JOIN narrative_charts nc
            ON nc.name = content ->> '$."narrative-chart"'
        LEFT JOIN chart_configs cc
            ON cc.id = nc.chartConfigId
        -- only works if the image block comes first
        LEFT JOIN images i
            ON i.filename = COALESCE(pg.content ->> '$.body[0].smallFilename', pg.content ->> '$.body[0].filename')
        WHERE
            pg.type = 'data-insight'
            AND i.replacedBy IS NULL
            AND nc.id = ?
        `,
        [narrativeChartId]
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
