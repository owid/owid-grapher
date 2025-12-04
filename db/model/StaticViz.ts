import {
    DbEnrichedStaticViz,
    ImagesTableName,
    StaticVizTableName,
    UsersTableName,
    LinkedStaticViz,
} from "@ourworldindata/types"
import * as db from "../db.js"
import urlJoin from "url-join"
import { BAKED_GRAPHER_URL } from "../../settings/clientSettings.js"

/**
 * General query used in multiple places
 * We make this selection and transform it into an EnrichedRow for the admin
 * and a LinkedStaticViz for the site.
 */

const BASE_STATIC_VIZ_QUERY = `-- sql
    SELECT
        sv.id,
        sv.name,
        sv.description,
        sv.grapherSlug,
        sv.sourceUrl,
        sv.createdAt,
        sv.updatedAt,
        u.fullName AS createdBy,
        u2.fullName AS updatedBy,
        c.id AS chartId,
        desktopImage.defaultAlt AS desktopImageAlt,
        desktopImage.id AS desktopImageId,
        desktopImage.cloudflareId AS desktopImageCloudflareId,
        desktopImage.filename AS desktopImageFilename,
        desktopImage.originalHeight AS desktopImageOriginalHeight,
        desktopImage.originalWidth AS desktopImageOriginalWidth,
        desktopImage.updatedAt AS desktopImageUpdatedAt,
        mobileImage.defaultAlt AS mobileImageAlt,
        mobileImage.id AS mobileImageId,
        mobileImage.cloudflareId AS mobileImageCloudflareId,
        mobileImage.filename AS mobileImageFilename,
        mobileImage.originalHeight AS mobileImageOriginalHeight,
        mobileImage.originalWidth AS mobileImageOriginalWidth,
        mobileImage.updatedAt AS mobileImageUpdatedAt
    FROM
        ${StaticVizTableName} sv
    LEFT JOIN ${UsersTableName} u ON sv.createdBy = u.id
    LEFT JOIN ${UsersTableName} u2 ON sv.updatedBy = u2.id
    LEFT JOIN charts c ON c.configId IN (SELECT id FROM chart_configs WHERE slug = sv.grapherSlug)
    INNER JOIN
        ${ImagesTableName} desktopImage ON sv.imageId = desktopImage.id
    LEFT JOIN
        ${ImagesTableName} mobileImage ON sv.mobileImageId = mobileImage.id
`

/** The type for the query above */
type StaticVizRow = {
    id: number
    name: string
    description: string | null
    grapherSlug: string | null
    sourceUrl: string | null
    createdAt: Date
    updatedAt: Date
    createdBy: string | null
    updatedBy: string | null
    chartId: number | null
    desktopImageAlt: string
    desktopImageId: number
    desktopImageCloudflareId: string
    desktopImageFilename: string
    desktopImageOriginalHeight: number
    desktopImageOriginalWidth: number
    desktopImageUpdatedAt: number | null
    mobileImageAlt: string | null
    mobileImageId: number | null
    mobileImageCloudflareId: string | null
    mobileImageFilename: string | null
    mobileImageOriginalHeight: number | null
    mobileImageOriginalWidth: number | null
    mobileImageUpdatedAt: number | null
}

/**
 * Admin functions
 */

function rowToEnrichedStaticViz(row: StaticVizRow): DbEnrichedStaticViz {
    const vizInfo: DbEnrichedStaticViz = {
        createdAt: row.createdAt,
        createdBy: row.createdBy || "",
        description: row.description || "",
        grapherSlug: row.grapherSlug || "",
        chartId: row.chartId ?? undefined,
        id: row.id,
        name: row.name,
        sourceUrl: row.sourceUrl || "",
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy || "",
        desktop: {
            cloudflareId: row.desktopImageCloudflareId,
            filename: row.desktopImageFilename,
            id: row.desktopImageId,
            originalHeight: row.desktopImageOriginalHeight,
            originalWidth: row.desktopImageOriginalWidth,
        },
    }

    // If mobileImageFilename is not null, the LEFT JOIN was successful.
    if (row.mobileImageFilename) {
        vizInfo.mobile = {
            cloudflareId: row.mobileImageCloudflareId || "",
            filename: row.mobileImageFilename,
            id: row.mobileImageId!,
            originalHeight: row.mobileImageOriginalHeight!,
            originalWidth: row.mobileImageOriginalWidth!,
        }
    }

    return vizInfo
}

export async function getEnrichedStaticVizById(
    trx: db.KnexReadonlyTransaction,
    id: number
): Promise<DbEnrichedStaticViz> {
    const query = `${BASE_STATIC_VIZ_QUERY} WHERE sv.id = ?`

    const [viz] = await db.knexRaw<StaticVizRow>(trx, query, [id])

    if (!viz) {
        throw new Error(`Static visualization with id ${id} not found.`)
    }

    return rowToEnrichedStaticViz(viz)
}

export async function getEnrichedStaticVizList(
    trx: db.KnexReadonlyTransaction
): Promise<DbEnrichedStaticViz[]> {
    const vizList = await db.knexRaw<StaticVizRow>(trx, BASE_STATIC_VIZ_QUERY)
    return vizList.map(rowToEnrichedStaticViz)
}

/**
 * Site functions
 */

function rowToLinkedStaticViz(row: StaticVizRow): LinkedStaticViz {
    const linkedStaticViz: LinkedStaticViz = {
        desktop: {
            cloudflareId: row.desktopImageCloudflareId,
            filename: row.desktopImageFilename,
            originalHeight: row.desktopImageOriginalHeight,
            originalWidth: row.desktopImageOriginalWidth,
            updatedAt: new Date(row.desktopImageUpdatedAt ?? 0).getTime(),
            defaultAlt: row.desktopImageAlt,
        },
        name: row.name,
        grapherUrl: row.grapherSlug
            ? urlJoin(BAKED_GRAPHER_URL, row.grapherSlug)
            : "",
        sourceUrl: row.sourceUrl || "",
        description: row.description || "",
    }
    if (row.mobileImageFilename) {
        linkedStaticViz.mobile = {
            cloudflareId: row.mobileImageCloudflareId!,
            filename: row.mobileImageFilename,
            originalHeight: row.mobileImageOriginalHeight!,
            originalWidth: row.mobileImageOriginalWidth!,
            updatedAt: new Date(row.mobileImageUpdatedAt ?? 0).getTime(),
            defaultAlt: row.mobileImageAlt!,
        }
    }
    return linkedStaticViz
}

export async function getLinkedStaticVizByNames(
    trx: db.KnexReadonlyTransaction,
    names: string[]
): Promise<LinkedStaticViz[]> {
    if (names.length === 0) {
        return []
    }
    const placeholders = names.map(() => "?").join(", ")
    const query = `${BASE_STATIC_VIZ_QUERY} WHERE sv.name IN (${placeholders})`

    const results = await db.knexRaw<StaticVizRow>(trx, query, names)
    return results.map(rowToLinkedStaticViz)
}
