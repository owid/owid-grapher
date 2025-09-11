import {
    DbPlainTag,
    DbPlainDatasetTag,
    JsonError,
    DbRawVariable,
    DbRawOrigin,
    parseOriginsRow,
} from "@ourworldindata/types"
import {
    OldChartFieldList,
    oldChartFieldList,
    assignTagsForCharts,
} from "../../db/model/Chart.js"
import {
    getDatasetById,
    setTagsForDataset,
    checkDatasetVariablesInUse,
} from "../../db/model/Dataset.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash-es"
import { Request } from "express"
import * as e from "express"

export async function getDatasets(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const datasets = await db.knexRaw<Record<string, any>>(
        trx,
        `-- sql
    WITH variable_counts AS (
        SELECT
            v.datasetId,
            COUNT(DISTINCT cd.chartId) as numCharts
        FROM chart_dimensions cd
        JOIN variables v ON cd.variableId = v.id
        GROUP BY v.datasetId
    )
    SELECT
        ad.id,
        ad.namespace,
        ad.name,
        d.shortName,
        ad.description,
        ad.dataEditedAt,
        du.fullName AS dataEditedByUserName,
        ad.metadataEditedAt,
        mu.fullName AS metadataEditedByUserName,
        ad.isPrivate,
        ad.nonRedistributable,
        d.version,
        vc.numCharts
    FROM active_datasets ad
    LEFT JOIN variable_counts vc ON ad.id = vc.datasetId
    JOIN users du ON du.id=ad.dataEditedByUserId
    JOIN users mu ON mu.id=ad.metadataEditedByUserId
    JOIN datasets d ON d.id=ad.id
    ORDER BY ad.dataEditedAt DESC
    `
    )

    const tags = await db.knexRaw<
        Pick<DbPlainTag, "id" | "name"> & Pick<DbPlainDatasetTag, "datasetId">
    >(
        trx,
        `-- sql
    SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
    JOIN tags t ON dt.tagId = t.id
    `
    )
    const tagsByDatasetId = lodash.groupBy(tags, (t) => t.datasetId)
    for (const dataset of datasets) {
        dataset.tags = (tagsByDatasetId[dataset.id] || []).map((t) =>
            lodash.omit(t, "datasetId")
        )
    }
    /*LEFT JOIN variables AS v ON v.datasetId=d.id
    GROUP BY d.id*/

    return { datasets: datasets }
}

export async function getDataset(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const datasetId = expectInt(req.params.datasetId)

    const dataset = await db.knexRawFirst<Record<string, any>>(
        trx,
        `-- sql
    SELECT d.id,
        d.namespace,
        d.name,
        d.shortName,
        d.version,
        d.description,
        d.updatedAt,
        d.dataEditedAt,
        d.dataEditedByUserId,
        du.fullName AS dataEditedByUserName,
        d.metadataEditedAt,
        d.metadataEditedByUserId,
        mu.fullName AS metadataEditedByUserName,
        d.isPrivate,
        d.isArchived,
        d.nonRedistributable,
        d.updatePeriodDays
    FROM datasets AS d
    JOIN users du ON du.id=d.dataEditedByUserId
    JOIN users mu ON mu.id=d.metadataEditedByUserId
    WHERE d.id = ?
    `,
        [datasetId]
    )

    if (!dataset) throw new JsonError(`No dataset by id '${datasetId}'`, 404)

    const variables = await db.knexRaw<
        Pick<
            DbRawVariable,
            "id" | "name" | "description" | "display" | "catalogPath"
        >
    >(
        trx,
        `-- sql
        SELECT
            v.id,
            v.name,
            v.description,
            v.display,
            v.catalogPath
        FROM
            variables AS v
        WHERE
            v.datasetId = ?
    `,
        [datasetId]
    )

    for (const v of variables) {
        v.display = JSON.parse(v.display)
    }

    dataset.variables = variables

    // add all origins
    const origins: DbRawOrigin[] = await db.knexRaw<DbRawOrigin>(
        trx,
        `-- sql
        SELECT DISTINCT
            o.*
        FROM
            origins_variables AS ov
            JOIN origins AS o ON ov.originId = o.id
            JOIN variables AS v ON ov.variableId = v.id
        WHERE
            v.datasetId = ?
    `,
        [datasetId]
    )

    const parsedOrigins = origins.map(parseOriginsRow)

    dataset.origins = parsedOrigins

    const sources = await db.knexRaw<{
        id: number
        name: string
        description: string
    }>(
        trx,
        `
    SELECT s.id, s.name, s.description
    FROM sources AS s
    WHERE s.datasetId = ?
    ORDER BY s.id ASC
    `,
        [datasetId]
    )

    // expand description of sources and add to dataset as variableSources
    dataset.variableSources = sources.map((s: any) => {
        return {
            id: s.id,
            name: s.name,
            ...JSON.parse(s.description),
        }
    })

    const charts = await db.knexRaw<OldChartFieldList>(
        trx,
        `-- sql
            SELECT ${oldChartFieldList},
                round(views_365d / 365, 1) as pageviewsPerDay,
                crv.narrativeChartsCount,
                crv.referencesCount
            FROM charts
            JOIN chart_configs ON chart_configs.id = charts.configId
            JOIN chart_dimensions AS cd ON cd.chartId = charts.id
            JOIN variables AS v ON cd.variableId = v.id
            JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
            LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
            LEFT JOIN analytics_pageviews on (analytics_pageviews.url = CONCAT("https://ourworldindata.org/grapher/", chart_configs.slug) AND chart_configs.full ->> '$.isPublished' = "true" )
            LEFT JOIN chart_references_view crv ON crv.chartId = charts.id
            WHERE v.datasetId = ?
            GROUP BY charts.id, views_365d, crv.narrativeChartsCount, crv.referencesCount
        `,
        [datasetId]
    )

    dataset.charts = charts

    await assignTagsForCharts(trx, charts)

    const tags = await db.knexRaw<{ id: number; name: string }>(
        trx,
        `
    SELECT t.id, t.name
    FROM tags t
    JOIN dataset_tags dt ON dt.tagId = t.id
    WHERE dt.datasetId = ?
    `,
        [datasetId]
    )
    dataset.tags = tags

    const availableTags = await db.knexRaw<{
        id: number
        name: string
        parentName: string
    }>(
        trx,
        `
    SELECT t.id, t.name, p.name AS parentName
    FROM tags AS t
    JOIN tags AS p ON t.parentId=p.id
    `
    )
    dataset.availableTags = availableTags

    return { dataset: dataset }
}

export async function updateDataset(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    // Only updates `nonRedistributable` and `tags`, other fields come from ETL
    // and are not editable
    const datasetId = expectInt(req.params.datasetId)
    const dataset = await getDatasetById(trx, datasetId)
    if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

    const newDataset = (req.body as { dataset: any }).dataset
    await db.knexRaw(
        trx,
        `
        UPDATE datasets
        SET
            nonRedistributable=?,
            metadataEditedAt=?,
            metadataEditedByUserId=?
        WHERE id=?
        `,
        [
            newDataset.nonRedistributable,
            new Date(),
            _res.locals.user.id,
            datasetId,
        ]
    )

    const tagRows = newDataset.tags.map((tag: any) => [tag.id, datasetId])
    await db.knexRaw(trx, `DELETE FROM dataset_tags WHERE datasetId=?`, [
        datasetId,
    ])
    if (tagRows.length)
        for (const tagRow of tagRows) {
            await db.knexRaw(
                trx,
                `INSERT INTO dataset_tags (tagId, datasetId) VALUES (?, ?)`,
                tagRow
            )
        }

    return { success: true }
}

export async function setArchived(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const datasetId = expectInt(req.params.datasetId)
    const dataset = await getDatasetById(trx, datasetId)
    if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

    const usageCheck = await checkDatasetVariablesInUse(trx, datasetId)

    if (usageCheck.inUse) {
        const labels: Record<string, string> = {
            chartsCount: "chart",
            explorersCount: "explorer",
            multiDimCount: "multi-dimensional data page",
        }

        const usageParts = Object.entries(usageCheck.usageDetails)
            .filter(([_, n]) => !!n)
            .map(([key, n]) => `${n} ${labels[key]}${n > 1 ? "s" : ""}`)

        throw new JsonError(
            `Cannot archive dataset: its variables are currently used in ${usageParts.join(", ")}. ` +
                `Please remove these references before archiving the dataset.`,
            400
        )
    }

    await db.knexRaw(trx, `UPDATE datasets SET isArchived = 1 WHERE id=?`, [
        datasetId,
    ])
    return { success: true }
}

export async function setTags(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const datasetId = expectInt(req.params.datasetId)

    await setTagsForDataset(trx, datasetId, req.body.tagIds)

    return { success: true }
}

export async function republishCharts(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const datasetId = expectInt(req.params.datasetId)

    const dataset = await getDatasetById(trx, datasetId)
    if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

    if (req.body.republish) {
        await db.knexRaw(
            trx,
            `-- sql
                UPDATE chart_configs cc
                JOIN charts c ON c.configId = cc.id
                SET
                    cc.patch = JSON_SET(cc.patch, "$.version", cc.patch->"$.version" + 1),
                    cc.full = JSON_SET(cc.full, "$.version", cc.full->"$.version" + 1)
                WHERE c.id IN (
                    SELECT DISTINCT chart_dimensions.chartId
                    FROM chart_dimensions
                    JOIN variables ON variables.id = chart_dimensions.variableId
                    WHERE variables.datasetId = ?
                )`,
            [datasetId]
        )
    }

    await triggerStaticBuild(
        _res.locals.user,
        `Republishing all charts in dataset ${dataset.name} (${dataset.id})`
    )

    return { success: true }
}
