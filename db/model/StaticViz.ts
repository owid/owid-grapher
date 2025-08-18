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

const BASE_STATIC_VIZ_QUERY = `-- sql
    SELECT
        sv.id,
        sv.slug,
        sv.title,
        sv.description,
        sv.grapherSlug,
        sv.sourceUrl,
        sv.createdAt,
        sv.updatedAt,
        u.fullName AS createdBy,
        u2.fullName AS updatedBy,
        desktopImage.defaultAlt AS desktopImageAlt,
        desktopImage.id AS desktopImageId,
        desktopImage.imageText AS desktopImageText,
        desktopImage.cloudflareId AS desktopImageCloudflareId,
        desktopImage.filename AS desktopImageFilename,
        desktopImage.originalHeight AS desktopImageOriginalHeight,
        desktopImage.originalWidth AS desktopImageOriginalWidth,
        desktopImage.updatedAt AS desktopImageUpdatedAt,
        mobileImage.defaultAlt AS mobileImageAlt,
        mobileImage.id AS mobileImageId,
        mobileImage.imageText AS mobileImageText,
        mobileImage.cloudflareId AS mobileImageCloudflareId,
        mobileImage.filename AS mobileImageFilename,
        mobileImage.originalHeight AS mobileImageOriginalHeight,
        mobileImage.originalWidth AS mobileImageOriginalWidth,
        mobileImage.updatedAt AS mobileImageUpdatedAt
    FROM
        ${StaticVizTableName} sv
    JOIN ${UsersTableName} u ON sv.createdBy = u.id
    JOIN ${UsersTableName} u2 ON sv.updatedBy = u2.id
    JOIN
        ${ImagesTableName} desktopImage ON sv.imageId = desktopImage.id
    LEFT JOIN
        ${ImagesTableName} mobileImage ON sv.mobileImageId = mobileImage.id
`

function rowToEnrichedStaticViz(row: any): DbEnrichedStaticViz {
    const vizInfo: DbEnrichedStaticViz = {
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        description: row.description,
        grapherSlug: row.grapherSlug,
        id: row.id,
        slug: row.slug,
        sourceUrl: row.sourceUrl,
        title: row.title,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        desktop: {
            alt: row.desktopImageAlt,
            cloudflareId: row.desktopImageCloudflareId,
            filename: row.desktopImageFilename,
            id: row.desktopImageId,
            originalHeight: row.desktopImageOriginalHeight,
            originalWidth: row.desktopImageOriginalWidth,
            text: row.desktopImageText,
        },
    }

    // If mobileImageFilename is not null, the LEFT JOIN was successful.
    if (row.mobileImageFilename) {
        vizInfo.mobile = {
            alt: row.mobileImageAlt,
            cloudflareId: row.mobileImageCloudflareId,
            filename: row.mobileImageFilename,
            id: row.mobileImageId,
            originalHeight: row.mobileImageOriginalHeight,
            originalWidth: row.mobileImageOriginalWidth,
            text: row.mobileImageText,
        }
    }

    return vizInfo
}

export async function getEnrichedStaticVizById(
    trx: db.KnexReadonlyTransaction,
    id: number
): Promise<DbEnrichedStaticViz> {
    const query = `${BASE_STATIC_VIZ_QUERY} WHERE sv.id = ?`

    const [viz] = await db.knexRaw(trx, query, [id])

    if (!viz) {
        throw new Error(`Static visualization with id ${id} not found.`)
    }

    return rowToEnrichedStaticViz(viz)
}

export async function getEnrichedStaticVizList(
    trx: db.KnexReadonlyTransaction
): Promise<DbEnrichedStaticViz[]> {
    const vizList = await db.knexRaw<any>(trx, BASE_STATIC_VIZ_QUERY)
    return vizList.map(rowToEnrichedStaticViz)
}

export async function getLinkedStaticVizBySlugs(
    trx: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<LinkedStaticViz[]> {
    if (slugs.length === 0) {
        return []
    }

    const placeholders = slugs.map(() => "?").join(", ")
    const query = `${BASE_STATIC_VIZ_QUERY} WHERE sv.slug IN (${placeholders})`

    const results = await db.knexRaw<any>(trx, query, slugs)

    return results.map((row: any) => {
        const linkedStaticViz: LinkedStaticViz = {
            desktop: {
                defaultAlt: row.desktopImageAlt,
                cloudflareId: row.desktopImageCloudflareId,
                filename: row.desktopImageFilename,
                originalHeight: row.desktopImageOriginalHeight,
                originalWidth: row.desktopImageOriginalWidth,
                updatedAt: row.desktopImageUpdatedAt,
            },
            slug: row.slug,
            title: row.title,
            grapherUrl: row.grapherSlug
                ? urlJoin(BAKED_GRAPHER_URL, row.grapherSlug)
                : "",
            sourceUrl: row.sourceUrl,
            description: row.description || "",
        }
        if (row.mobileImageFilename) {
            linkedStaticViz.mobile = {
                defaultAlt: row.mobileImageAlt,
                cloudflareId: row.mobileImageCloudflareId,
                filename: row.mobileImageFilename,
                originalHeight: row.mobileImageOriginalHeight,
                originalWidth: row.mobileImageOriginalWidth,
                updatedAt: row.mobileImageUpdatedAt,
            }
        }
        return linkedStaticViz
    })
}
