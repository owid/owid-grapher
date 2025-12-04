import {
    JsonError,
    DbRawStaticViz,
    StaticVizInsertSchema,
    StaticVizUpdateSchema,
    DbRawPostGdoc,
} from "@ourworldindata/types"
import {
    getEnrichedStaticVizById,
    getEnrichedStaticVizList,
} from "../../db/model/StaticViz.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash-es"
import e from "express"
import { Request } from "../authentication.js"
import { isSlugUsedInOtherGrapher } from "../validation.js"

export async function getStaticVizListHandler(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return await getEnrichedStaticVizList(trx)
}

export async function getStaticVizByIdHandler(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const staticVizId = expectInt(req.params.staticVizId)

    const staticViz = await getEnrichedStaticVizById(trx, staticVizId)

    return {
        staticViz,
    }
}

export async function createStaticViz(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const parseResult = StaticVizInsertSchema.safeParse(req.body)
    if (!parseResult.success) {
        throw new JsonError(JSON.stringify(parseResult.error), 400)
    }
    const parsedData = parseResult.data

    // Check if name already exists
    const existingName = await trx
        .table("static_viz")
        .where("name", parsedData.name)
        .first()

    if (existingName) {
        throw new JsonError(
            `Static viz with name "${parsedData.name}" already exists`,
            400
        )
    }

    if (!parsedData.grapherSlug && !parsedData.sourceUrl) {
        throw new JsonError(
            "Either grapherSlug or sourceUrl must be provided",
            400
        )
    }

    if (parsedData.grapherSlug) {
        const doesSlugExist = await isSlugUsedInOtherGrapher(
            trx,
            parsedData.grapherSlug
        )
        if (!doesSlugExist) {
            throw new JsonError(
                `Grapher with slug "${parsedData.grapherSlug}" does not exist`,
                400
            )
        }
    }

    // Validate that imageId exists
    const imageExists = await trx
        .table("images")
        .where("id", parsedData.imageId)
        .first()

    if (!imageExists) {
        throw new JsonError(
            `Image with id ${parsedData.imageId} does not exist`,
            400
        )
    }

    // Validate mobileImageId if provided
    if (parsedData.mobileImageId) {
        const mobileImageExists = await trx
            .table("images")
            .where("id", parsedData.mobileImageId)
            .first()

        if (!mobileImageExists) {
            throw new JsonError(
                `Mobile image with id ${parsedData.mobileImageId} does not exist`,
                400
            )
        }
    }

    const now = new Date()
    const insertData = {
        ...parsedData,
        createdBy: res.locals.user.id,
        updatedBy: res.locals.user.id,
        createdAt: now,
        updatedAt: now,
    }

    const result = await trx.table("static_viz").insert(insertData)
    const staticVizId = result[0]

    const newStaticViz = await trx
        .table("static_viz")
        .where("id", staticVizId)
        .select<DbRawStaticViz>()
        .first()

    return {
        success: true,
        staticViz: newStaticViz,
    }
}

export async function updateStaticViz(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const staticVizId = expectInt(req.params.staticVizId)

    const parsedData = StaticVizUpdateSchema.safeParse(req.body)
    if (!parsedData.success) {
        throw new JsonError(JSON.stringify(parsedData.error), 400)
    }
    const updateData = parsedData.data

    const existingStaticViz = (await trx
        .table("static_viz")
        .where("id", staticVizId)
        .first()) as DbRawStaticViz | undefined

    if (!existingStaticViz) {
        throw new JsonError(`No static viz found for id ${staticVizId}`, 404)
    }

    const updatableFields = [
        "name",
        "description",
        "grapherSlug",
        "sourceUrl",
        "imageId",
        "mobileImageId",
    ] as const

    const updatePayload = lodash.pick(updateData, updatableFields)

    if (Object.keys(updatePayload).length === 0) {
        throw new JsonError("No updatable fields provided", 400)
    }

    // Check if name is being updated and if it conflicts
    if (updatePayload.name && updatePayload.name !== existingStaticViz.name) {
        const conflictingName = await trx
            .table("static_viz")
            .where("name", updatePayload.name)
            .whereNot("id", staticVizId)
            .first()

        if (conflictingName) {
            throw new JsonError(
                `Static viz with name "${updatePayload.name}" already exists`,
                400
            )
        }
    }

    // Validate constraint: either grapherSlug or sourceUrl must be provided
    const finalGrapherSlug =
        updatePayload.grapherSlug !== undefined
            ? updatePayload.grapherSlug
            : existingStaticViz.grapherSlug
    const finalSourceUrl =
        updatePayload.sourceUrl !== undefined
            ? updatePayload.sourceUrl
            : existingStaticViz.sourceUrl

    if (!finalGrapherSlug && !finalSourceUrl) {
        throw new JsonError(
            "Either grapherSlug or sourceUrl must be provided",
            400
        )
    }

    // Validate imageId if being updated
    if (updatePayload.imageId) {
        const imageExists = await trx
            .table("images")
            .where("id", updatePayload.imageId)
            .first()

        if (!imageExists) {
            throw new JsonError(
                `Image with id ${updatePayload.imageId} does not exist`,
                400
            )
        }
    }

    // Validate mobileImageId if being updated
    if (updatePayload.mobileImageId) {
        const mobileImageExists = await trx
            .table("images")
            .where("id", updatePayload.mobileImageId)
            .first()

        if (!mobileImageExists) {
            throw new JsonError(
                `Mobile image with id ${updatePayload.mobileImageId} does not exist`,
                400
            )
        }
    }

    const finalUpdateData = {
        ...updatePayload,
        updatedBy: res.locals.user.id,
        updatedAt: new Date(),
    }

    await trx
        .table("static_viz")
        .where("id", staticVizId)
        .update(finalUpdateData)

    const updatedStaticViz = await trx
        .table("static_viz")
        .where("id", staticVizId)
        .select<DbRawStaticViz>()
        .first()

    return {
        success: true,
        staticViz: updatedStaticViz,
    }
}

export async function deleteStaticViz(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const staticVizId = expectInt(req.params.staticVizId)

    const staticViz = await trx
        .table("static_viz")
        .where("id", staticVizId)
        .first<DbRawStaticViz>()

    if (!staticViz) {
        throw new JsonError(`No static viz found for id ${staticVizId}`, 404)
    }

    // Check if the static viz is referenced in any published gdocs
    const referencingGdocs = await db.knexRaw<Pick<DbRawPostGdoc, "slug">>(
        trx,
        `-- sql
            SELECT pg.slug
            FROM posts_gdocs_links pgl
            JOIN posts_gdocs pg ON pg.id = pgl.sourceId
            WHERE pgl.target = ?
              AND pgl.linkType = 'static-viz'
              AND pg.published = true
        `,
        [staticViz.name]
    )

    if (referencingGdocs.length > 0) {
        const gdocsList = lodash
            .uniq(referencingGdocs.map((gdoc) => `"${gdoc.slug}"`))
            .join(", ")
        throw new JsonError(
            `Cannot delete static viz "${staticViz.name}" because it is referenced in the following published documents: ${gdocsList}`,
            400
        )
    }

    await trx.table("static_viz").where("id", staticVizId).delete()

    return {
        success: true,
    }
}
